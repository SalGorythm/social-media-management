#!/usr/bin/env python3
"""First-time bootstrap for Social Content Studio (not a setuptools package).

Usage (from repo root):
  python3 setup.py
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MIN_PY = (3, 10)


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def info(msg: str) -> None:
    print(f"→ {msg}")


def run(cmd: list[str], *, cwd: Path | None = None, env: dict | None = None) -> None:
    print(f"  $ {' '.join(cmd)}")
    subprocess.check_call(cmd, cwd=str(cwd or ROOT), env=env)


def ensure_python() -> None:
    if sys.version_info < MIN_PY:
        fail(f"Python {MIN_PY[0]}.{MIN_PY[1]}+ required (found {sys.version.split()[0]})")
    info(f"Python {sys.version.split()[0]} OK")


def ensure_npm() -> None:
    if not shutil.which("npm"):
        fail("npm not found. Install Node.js 18+ from https://nodejs.org/")
    try:
        out = subprocess.check_output(["npm", "--version"], text=True).strip()
    except subprocess.CalledProcessError as e:
        fail(f"npm is not runnable: {e}")
    info(f"npm {out} OK")


def ensure_dirs() -> None:
    for name in ("data", "content-queue", "content-archive", "products_contexts"):
        d = ROOT / name
        d.mkdir(parents=True, exist_ok=True)
        keep = d / ".gitkeep"
        if not keep.exists():
            keep.touch()
    info("Local folders ready (data, content-queue, content-archive, products_contexts)")


def ensure_env() -> None:
    example = ROOT / ".env.example"
    target = ROOT / ".env"
    if target.exists():
        info(".env already exists (left unchanged)")
        return
    if not example.exists():
        fail(".env.example missing")
    shutil.copy(example, target)
    info("Created .env from .env.example — edit JWT_SECRET before sharing publicly")


def ensure_venv() -> Path:
    venv = ROOT / ".venv"
    if not venv.exists():
        info("Creating .venv …")
        run([sys.executable, "-m", "venv", str(venv)])
    else:
        info(".venv already exists")

    if os.name == "nt":
        pip = venv / "Scripts" / "pip"
        python = venv / "Scripts" / "python"
    else:
        pip = venv / "bin" / "pip"
        python = venv / "bin" / "python"

    if not pip.exists():
        fail(f"venv pip not found at {pip}")

    info("Installing Python requirements …")
    run([str(pip), "install", "--upgrade", "pip"])
    run([str(pip), "install", "-r", "requirements.txt"])
    return python


def ensure_frontend() -> None:
    frontend = ROOT / "frontend"
    if not frontend.is_dir():
        fail("frontend/ directory missing")
    info("Installing frontend npm packages …")
    run(["npm", "install"], cwd=frontend)


def print_next_steps() -> None:
    activate = (
        ".venv\\Scripts\\activate"
        if os.name == "nt"
        else "source .venv/bin/activate"
    )
    print(
        f"""
Setup complete.

Next steps:
  1. {activate}
  2. Edit .env if needed (especially JWT_SECRET)
  3. python run.py

Then open http://127.0.0.1:5173 and sign up.

Docker alternative (after setup or independently):
  docker compose up --build
  # or single image: docker build -t social-content-studio . && docker run --env-file .env -p 8000:8000 -v \"$PWD/data:/app/data\" -v \"$PWD/content-queue:/app/content-queue\" -v \"$PWD/content-archive:/app/content-archive\" social-content-studio

Drop product briefs in products_contexts/ (gitignored). Copy examples/sample-content-queue.json into content-queue/ to try a scan.
"""
    )


def main() -> None:
    os.chdir(ROOT)
    print("Social Content Studio — first-time setup\n")
    ensure_python()
    ensure_npm()
    ensure_dirs()
    ensure_env()
    ensure_venv()
    ensure_frontend()
    print_next_steps()


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        fail(f"Command failed with exit code {e.returncode}")
