from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from api.config import get_settings

SALT_ROUNDS = 10


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=SALT_ROUNDS)).decode(
        "utf-8"
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def sign_token(user: dict[str, Any]) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "exp": datetime.now(timezone.utc)
        + timedelta(days=settings["jwt_expires_days"]),
    }
    return jwt.encode(payload, settings["jwt_secret"], algorithm="HS256")


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings["jwt_secret"], algorithms=["HS256"])
