from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env")


@lru_cache
def get_settings() -> dict:
    db_path = os.getenv("DB_PATH", "data/studio.db")
    if not Path(db_path).is_absolute():
        db_path = str(REPO_ROOT / db_path)

    cors = os.getenv(
        "CORS_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173",
    )
    origins = [o.strip() for o in cors.split(",") if o.strip()]

    secret = os.getenv("JWT_SECRET") or "social-content-studio-dev-secret-change-me"
    if not os.getenv("JWT_SECRET"):
        print("[auth] JWT_SECRET is not set; using insecure dev default")

    static_dir = os.getenv("STATIC_DIR", str(REPO_ROOT / "frontend" / "dist"))
    if not Path(static_dir).is_absolute():
        static_dir = str(REPO_ROOT / static_dir)

    return {
        "jwt_secret": secret,
        "jwt_expires_days": 14,
        "backend_host": os.getenv("BACKEND_HOST", "127.0.0.1"),
        "backend_port": int(os.getenv("BACKEND_PORT", "8000")),
        "frontend_host": os.getenv("FRONTEND_HOST", "127.0.0.1"),
        "frontend_port": int(os.getenv("FRONTEND_PORT", "5173")),
        "db_path": db_path,
        "cors_origins": origins,
        "repo_root": REPO_ROOT,
        "content_queue": REPO_ROOT / "content-queue",
        "content_archive": REPO_ROOT / "content-archive",
        "data_dir": REPO_ROOT / "data",
        "static_dir": Path(static_dir),
    }
