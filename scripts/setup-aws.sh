#!/bin/bash
set -e

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}
APP=appforge

echo "==> Account: $ACCOUNT_ID | Region: $REGION"

# ─── S3 Bucket ───────────────────────────────────────────────────────────────
BUCKET="${APP}-context-${ACCOUNT_ID}"
echo ""
echo "==> Creating S3 bucket: $BUCKET"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "    already exists"
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
  # Block all public access
  aws s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
  echo "    created"
fi

# ─── ECR Repository ──────────────────────────────────────────────────────────
echo ""
echo "==> Creating ECR repository: ${APP}-agent"
ECR_REPO=$(aws ecr describe-repositories --repository-names "${APP}-agent" \
  --query "repositories[0].repositoryUri" --output text 2>/dev/null || true)
if [ -z "$ECR_REPO" ] || [ "$ECR_REPO" = "None" ]; then
  ECR_REPO=$(aws ecr create-repository --repository-name "${APP}-agent" \
    --query "repository.repositoryUri" --output text)
  echo "    created: $ECR_REPO"
else
  echo "    already exists: $ECR_REPO"
fi

# ─── IAM: Task Execution Role (ECS pulls image + writes logs) ────────────────
EXEC_ROLE="${APP}-ecs-execution-role"
echo ""
echo "==> Creating IAM execution role: $EXEC_ROLE"
if aws iam get-role --role-name "$EXEC_ROLE" 2>/dev/null; then
  echo "    already exists"
else
  aws iam create-role --role-name "$EXEC_ROLE" \
    --assume-role-policy-document '{
      "Version":"2012-10-17",
      "Statement":[{
        "Effect":"Allow",
        "Principal":{"Service":"ecs-tasks.amazonaws.com"},
        "Action":"sts:AssumeRole"
      }]
    }' > /dev/null
  aws iam attach-role-policy --role-name "$EXEC_ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
  echo "    created"
fi
EXEC_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${EXEC_ROLE}"

# ─── IAM: Task Role (container accesses S3) ──────────────────────────────────
TASK_ROLE="${APP}-ecs-task-role"
echo ""
echo "==> Creating IAM task role: $TASK_ROLE"
if aws iam get-role --role-name "$TASK_ROLE" 2>/dev/null; then
  echo "    already exists"
else
  aws iam create-role --role-name "$TASK_ROLE" \
    --assume-role-policy-document '{
      "Version":"2012-10-17",
      "Statement":[{
        "Effect":"Allow",
        "Principal":{"Service":"ecs-tasks.amazonaws.com"},
        "Action":"sts:AssumeRole"
      }]
    }' > /dev/null

  # S3 full access to the appforge bucket
  aws iam put-role-policy --role-name "$TASK_ROLE" \
    --policy-name "${APP}-s3-access" \
    --policy-document "{
      \"Version\":\"2012-10-17\",
      \"Statement\":[{
        \"Effect\":\"Allow\",
        \"Action\":[\"s3:GetObject\",\"s3:PutObject\",\"s3:DeleteObject\",\"s3:ListBucket\"],
        \"Resource\":[
          \"arn:aws:s3:::${BUCKET}\",
          \"arn:aws:s3:::${BUCKET}/*\"
        ]
      }]
    }"
  echo "    created"
fi
TASK_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${TASK_ROLE}"

# ─── CloudWatch Log Group ─────────────────────────────────────────────────────
LOG_GROUP="/ecs/${APP}-agent"
echo ""
echo "==> Creating CloudWatch log group: $LOG_GROUP"
aws logs create-log-group --log-group-name "$LOG_GROUP" 2>/dev/null || echo "    already exists"

# ─── ECS Cluster ─────────────────────────────────────────────────────────────
echo ""
echo "==> Creating ECS cluster: ${APP}-cluster"
CLUSTER_ARN=$(aws ecs create-cluster --cluster-name "${APP}-cluster" \
  --query "cluster.clusterArn" --output text)
echo "    $CLUSTER_ARN"

# ─── VPC: get default subnet and create security group ───────────────────────
echo ""
echo "==> Getting default VPC..."
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" --output text)
echo "    VPC: $VPC_ID"

echo "==> Getting first public subnet..."
SUBNET_ID=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=default-for-az,Values=true" \
  --query "Subnets[0].SubnetId" --output text)
echo "    Subnet: $SUBNET_ID"

echo "==> Creating security group: ${APP}-agent-sg"
SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=${APP}-agent-sg" "Name=vpc-id,Values=$VPC_ID" \
  --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || true)
if [ -z "$SG_ID" ] || [ "$SG_ID" = "None" ]; then
  SG_ID=$(aws ec2 create-security-group \
    --group-name "${APP}-agent-sg" \
    --description "AppForge agent outbound-only" \
    --vpc-id "$VPC_ID" \
    --query "GroupId" --output text)
  # Allow all outbound (agents need internet for GitHub, Vercel, npm, APIs)
  # Default SG already allows all outbound; no inbound needed
  echo "    created: $SG_ID"
else
  echo "    already exists: $SG_ID"
fi

# ─── ECS Task Definition ─────────────────────────────────────────────────────
echo ""
echo "==> Registering ECS task definition: ${APP}-agent"
TASK_DEF_ARN=$(aws ecs register-task-definition \
  --family "${APP}-agent" \
  --requires-compatibilities FARGATE \
  --network-mode awsvpc \
  --cpu 1024 \
  --memory 2048 \
  --execution-role-arn "$EXEC_ROLE_ARN" \
  --task-role-arn "$TASK_ROLE_ARN" \
  --container-definitions "[{
    \"name\": \"appforge-agent\",
    \"image\": \"${ECR_REPO}:latest\",
    \"essential\": true,
    \"logConfiguration\": {
      \"logDriver\": \"awslogs\",
      \"options\": {
        \"awslogs-group\": \"${LOG_GROUP}\",
        \"awslogs-region\": \"${REGION}\",
        \"awslogs-stream-prefix\": \"agent\"
      }
    },
    \"environment\": []
  }]" \
  --query "taskDefinition.taskDefinitionArn" --output text)
echo "    $TASK_DEF_ARN"

# ─── Write .env values ───────────────────────────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env"
echo ""
echo "==> Updating .env..."

update_env() {
  local key=$1
  local val=$2
  if grep -q "^${key}=" "$ENV_FILE"; then
    # Replace existing line (macOS-compatible sed)
    sed -i '' "s|^${key}=.*|${key}=\"${val}\"|" "$ENV_FILE"
  else
    echo "${key}=\"${val}\"" >> "$ENV_FILE"
  fi
}

update_env "AWS_REGION"               "$REGION"
update_env "S3_BUCKET_NAME"           "$BUCKET"
update_env "ECS_CLUSTER_ARN"          "$CLUSTER_ARN"
update_env "ECS_TASK_DEFINITION_ARN"  "$TASK_DEF_ARN"
update_env "ECS_SUBNET_ID"            "$SUBNET_ID"
update_env "ECS_SECURITY_GROUP_ID"    "$SG_ID"

echo ""
echo "══════════════════════════════════════════════════"
echo "  AWS infrastructure ready."
echo "══════════════════════════════════════════════════"
echo ""
echo "  S3 bucket:      $BUCKET"
echo "  ECR repo:       $ECR_REPO"
echo "  ECS cluster:    $CLUSTER_ARN"
echo "  Task def:       $TASK_DEF_ARN"
echo "  Subnet:         $SUBNET_ID"
echo "  Security group: $SG_ID"
echo ""
echo "Next: build and push the Docker image:"
echo ""
echo "  aws ecr get-login-password --region $REGION | \\"
echo "    docker login --username AWS --password-stdin ${ECR_REPO}"
echo ""
echo "  docker build -t ${APP}-agent ."
echo "  docker tag ${APP}-agent:latest ${ECR_REPO}:latest"
echo "  docker push ${ECR_REPO}:latest"
echo ""
