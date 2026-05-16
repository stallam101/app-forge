FROM --platform=linux/amd64 node:22-slim

# System deps
RUN apt-get update && apt-get install -y \
  git curl wget gnupg ca-certificates chromium \
  && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh && rm -rf /var/lib/apt/lists/*

# Global CLIs
RUN npm install -g vercel openclaw

# AWS CLI (agents use bash MCP + aws cli for S3 access)
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o awscliv2.zip \
  && apt-get update && apt-get install -y unzip && rm -rf /var/lib/apt/lists/* \
  && unzip -q awscliv2.zip && ./aws/install && rm -rf awscliv2.zip aws/

# MCP servers
RUN npm install -g \
  tavily-mcp \
  mcp-server-commands \
  @playwright/mcp \
  @modelcontextprotocol/server-github \
  @modelcontextprotocol/server-filesystem

# Playwright browser
RUN npx playwright install chromium --with-deps

WORKDIR /workspace

# Copy prompt templates and phase configs into image
COPY configs/prompts/ /workspace/prompts/
COPY configs/openclaw/ /workspace/openclaw/
COPY scripts/agent-entrypoint.sh /workspace/agent-entrypoint.sh
RUN chmod +x /workspace/agent-entrypoint.sh

ENTRYPOINT ["/workspace/agent-entrypoint.sh"]
