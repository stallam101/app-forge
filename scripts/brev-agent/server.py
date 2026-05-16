"""
Brev-side OpenClaw HTTP wrapper.

Exposes POST /run on :8080. AppForge's dispatchToBrev (src/lib/agent-runner.ts)
posts a job description; this server spawns OpenClaw as a background subprocess
and returns {ok, runId} within 5s. The agent emits its own progress callbacks
via curl from inside the prompt; this wrapper guarantees a terminal complete
or error callback on subprocess exit so failed runs never hang AppForge.

Contract (must not change without updating agent-runner.ts):

  POST /run
  Headers: Content-Type: application/json
           [optional] Authorization: Bearer ${BREV_AGENT_SECRET}
  Body:    {
             jobId, phase, projectId,
             callbackUrl, callbackToken,
             brief, openclawConfig, agentPrompt,
             env: { NVIDIA_API_KEY, NVIDIA_BASE_URL, TAVILY_API_KEY }
           }
  Returns: { ok: true, runId } within 5s

  GET /healthz -> { ok: true }
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


WORKDIR = Path(os.environ.get("BREV_AGENT_WORKDIR", str(Path.home() / "appforge-agent")))
RUNS_DIR = WORKDIR / "runs"
PROJECTS_DIR = WORKDIR / "projects"
LOG_DIR = WORKDIR / "logs"
SHARED_SECRET = os.environ.get("BREV_AGENT_SECRET")

OPENCLAW_BIN = os.environ.get("OPENCLAW_BIN", "openclaw")
OPENCLAW_RUN_ARGS_TEMPLATE = os.environ.get(
    "OPENCLAW_RUN_ARGS",
    "run --config {config_path} --prompt-file {prompt_path}",
)

ENV_VAR_PATTERN = re.compile(r"\$\{([A-Z0-9_]+)\}")


class EnvBlock(BaseModel):
    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    TAVILY_API_KEY: str = ""


class RunRequest(BaseModel):
    jobId: str
    phase: str
    projectId: str
    callbackUrl: str
    callbackToken: str
    brief: str = ""
    openclawConfig: str
    agentPrompt: str
    env: EnvBlock = Field(default_factory=EnvBlock)


@asynccontextmanager
async def lifespan(_: FastAPI):
    for d in (RUNS_DIR, PROJECTS_DIR, LOG_DIR):
        d.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="AppForge Brev Agent", lifespan=lifespan)


@app.get("/healthz")
async def healthz() -> Dict[str, bool]:
    return {"ok": True}


@app.post("/run")
async def run(req: Request) -> JSONResponse:
    if SHARED_SECRET:
        auth = req.headers.get("authorization", "")
        if not auth.startswith("Bearer ") or auth.removeprefix("Bearer ") != SHARED_SECRET:
            raise HTTPException(status_code=401, detail="Bad Bearer token")

    try:
        payload = RunRequest.model_validate(await req.json())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid body: {exc}")

    run_id = str(uuid.uuid4())
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    config_path = run_dir / "config.json"
    prompt_path = run_dir / "prompt.md"
    log_path = LOG_DIR / f"{run_id}.log"

    spawn_env = _build_env(payload, run_id)
    interpolated_config = _interpolate(payload.openclawConfig, spawn_env)
    config_path.write_text(interpolated_config, encoding="utf-8")
    prompt_path.write_text(payload.agentPrompt, encoding="utf-8")

    asyncio.create_task(
        _spawn_and_supervise(
            run_id=run_id,
            config_path=config_path,
            prompt_path=prompt_path,
            log_path=log_path,
            env=spawn_env,
            callback_url=payload.callbackUrl,
            callback_token=payload.callbackToken,
            job_id=payload.jobId,
            project_id=payload.projectId,
        )
    )

    return JSONResponse({"ok": True, "runId": run_id})


def _build_env(payload: RunRequest, run_id: str) -> Dict[str, str]:
    env = dict(os.environ)
    env.update(
        {
            "NVIDIA_API_KEY": payload.env.NVIDIA_API_KEY,
            "NVIDIA_BASE_URL": payload.env.NVIDIA_BASE_URL,
            "TAVILY_API_KEY": payload.env.TAVILY_API_KEY,
            "CALLBACK_URL": payload.callbackUrl,
            "JOB_ID": payload.jobId,
            "JOB_TOKEN": payload.callbackToken,
            "PROJECT_ID": payload.projectId,
            "RUN_ID": run_id,
            "PROJECT_DIR": str(PROJECTS_DIR / payload.projectId),
        }
    )
    return env


def _interpolate(text: str, env: Dict[str, str]) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        return env.get(key, match.group(0))

    return ENV_VAR_PATTERN.sub(repl, text)


async def _spawn_and_supervise(
    *,
    run_id: str,
    config_path: Path,
    prompt_path: Path,
    log_path: Path,
    env: Dict[str, str],
    callback_url: str,
    callback_token: str,
    job_id: str,
    project_id: str,
) -> None:
    project_workspace = PROJECTS_DIR / project_id
    project_workspace.mkdir(parents=True, exist_ok=True)

    args = OPENCLAW_RUN_ARGS_TEMPLATE.format(
        config_path=str(config_path), prompt_path=str(prompt_path)
    ).split()

    started_at = time.time()
    try:
        with open(log_path, "ab") as log_file:
            log_file.write(f"[{_iso(started_at)}] spawn {OPENCLAW_BIN} {' '.join(args)}\n".encode())
            proc = await asyncio.create_subprocess_exec(
                OPENCLAW_BIN,
                *args,
                cwd=str(project_workspace),
                env=env,
                stdout=log_file,
                stderr=log_file,
            )
    except FileNotFoundError:
        await _post_event(
            callback_url, callback_token, job_id,
            type_="error",
            message=f"OpenClaw binary not found: {OPENCLAW_BIN}. "
                    f"Set OPENCLAW_BIN env var or install OpenClaw.",
        )
        return
    except Exception as exc:
        await _post_event(
            callback_url, callback_token, job_id,
            type_="error",
            message=f"Failed to spawn OpenClaw: {exc}",
        )
        return

    exit_code = await proc.wait()
    elapsed = time.time() - started_at

    if exit_code == 0:
        artifacts = _collect_artifacts(project_workspace)
        await _post_event(
            callback_url, callback_token, job_id,
            type_="complete",
            message=f"OpenClaw run finished in {elapsed:.1f}s",
            metadata={"runId": run_id, "artifacts": artifacts, "exitCode": 0},
        )
    else:
        tail = _tail_file(log_path, max_bytes=4096)
        await _post_event(
            callback_url, callback_token, job_id,
            type_="error",
            message=f"OpenClaw exited with code {exit_code}",
            metadata={"runId": run_id, "exitCode": exit_code, "logTail": tail},
        )


def _collect_artifacts(project_dir: Path) -> list[Dict[str, Any]]:
    if not project_dir.exists():
        return []
    artifacts: list[Dict[str, Any]] = []
    for path in sorted(project_dir.rglob("*")):
        if path.is_file():
            rel = path.relative_to(project_dir)
            artifacts.append({"path": str(rel), "bytes": path.stat().st_size})
    return artifacts[:200]


def _tail_file(path: Path, max_bytes: int = 4096) -> str:
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            f.seek(max(0, size - max_bytes))
            return f.read().decode("utf-8", errors="replace")
    except FileNotFoundError:
        return ""


async def _post_event(
    callback_url: str,
    callback_token: str,
    job_id: str,
    *,
    type_: str,
    message: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    if not callback_url:
        return
    url = f"{callback_url.rstrip('/')}/api/jobs/{job_id}/events"
    body: Dict[str, Any] = {"type": type_, "message": message}
    if metadata is not None:
        body["metadata"] = metadata
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                url,
                json=body,
                headers={
                    "Authorization": f"Bearer {callback_token}",
                    "Content-Type": "application/json",
                },
            )
    except Exception as exc:
        log_line = f"[{_iso(time.time())}] callback {type_} failed: {exc}\n"
        try:
            (LOG_DIR / "callback-errors.log").open("a").write(log_line)
        except Exception:
            pass


def _iso(ts: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(ts))
