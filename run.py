#!/usr/bin/env python3
"""Start FastAPI backend + Vite frontend with ports from .env."""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

BACKEND_HOST = os.getenv("BACKEND_HOST", "127.0.0.1")
BACKEND_PORT = os.getenv("BACKEND_PORT", "8000")
FRONTEND_HOST = os.getenv("FRONTEND_HOST", "127.0.0.1")
FRONTEND_PORT = os.getenv("FRONTEND_PORT", "5173")
VITE_BACKEND_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}"

children: list[subprocess.Popen] = []


def terminate_all(signum=None, frame=None) -> None:
    for proc in children:
        if proc.poll() is None:
            try:
                proc.send_signal(signal.SIGTERM)
            except Exception:
                pass
    deadline = time.time() + 5
    for proc in children:
        remaining = max(0, deadline - time.time())
        try:
            proc.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            proc.kill()
    sys.exit(0)


def main() -> None:
    frontend_dir = ROOT / "frontend"
    if not frontend_dir.is_dir():
        print("frontend/ not found", file=sys.stderr)
        sys.exit(1)

    signal.signal(signal.SIGINT, terminate_all)
    signal.signal(signal.SIGTERM, terminate_all)

    env = os.environ.copy()
    env["VITE_BACKEND_URL"] = VITE_BACKEND_URL
    env["FRONTEND_PORT"] = str(FRONTEND_PORT)
    env["BACKEND_HOST"] = BACKEND_HOST
    env["BACKEND_PORT"] = str(BACKEND_PORT)

    print(f"[run] API  → http://{BACKEND_HOST}:{BACKEND_PORT}")
    print(f"[run] UI   → http://{FRONTEND_HOST}:{FRONTEND_PORT}")
    print(f"[run] proxy /api → {VITE_BACKEND_URL}")

    api = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "api.main:app",
            "--host",
            BACKEND_HOST,
            "--port",
            str(BACKEND_PORT),
            "--reload",
        ],
        cwd=str(ROOT),
        env=env,
    )
    children.append(api)

    # Brief pause so API is more likely up before Vite starts
    time.sleep(0.5)

    npm = "npm.cmd" if os.name == "nt" else "npm"
    frontend = subprocess.Popen(
        [npm, "run", "dev", "--", "--host", FRONTEND_HOST, "--port", str(FRONTEND_PORT)],
        cwd=str(frontend_dir),
        env=env,
    )
    children.append(frontend)

    # Wait until either exits
    while True:
        for proc in children:
            code = proc.poll()
            if code is not None:
                print(f"[run] process exited with {code}; shutting down")
                terminate_all()
        time.sleep(0.4)


if __name__ == "__main__":
    main()
