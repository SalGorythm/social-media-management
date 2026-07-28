from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from api.config import get_settings


def _fernet() -> Fernet:
    secret = get_settings()["jwt_secret"].encode("utf-8")
    key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(key)


def encrypt_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        raise ValueError("Could not decrypt API key; JWT_SECRET may have changed") from e


def mask_secret(plain: str) -> str:
    if not plain:
        return ""
    if len(plain) <= 4:
        return "****"
    return f"…{plain[-4:]}"
