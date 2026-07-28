from __future__ import annotations

from typing import Annotated, Any, Optional

from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api.auth import decode_token
from api.db import fetchone_dict, get_db, get_user_active_persona_id

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
) -> dict[str, Any]:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload.get("sub", 0))
        if user_id < 1:
            raise HTTPException(status_code=401, detail="Invalid token")
        email = payload.get("email") or ""
        return {"id": user_id, "email": email}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def resolve_persona_id(
    user: dict[str, Any],
    x_persona_id: Optional[str] = None,
) -> int:
    db = get_db()
    user_id = user["id"]
    if x_persona_id is not None and x_persona_id != "":
        try:
            pid = int(x_persona_id)
        except ValueError:
            pid = 0
        if pid > 0:
            row = fetchone_dict(
                db,
                "SELECT id FROM personas WHERE id = ? AND user_id = ?",
                (pid, user_id),
            )
            if row:
                return pid

    persona_id = get_user_active_persona_id(db, user_id)
    if not persona_id:
        raise HTTPException(
            status_code=400,
            detail="No workspace persona. Create one under Personas.",
        )
    return persona_id


def get_persona_id(
    user: Annotated[dict[str, Any], Depends(get_current_user)],
    x_persona_id: Annotated[Optional[str], Header(alias="X-Persona-Id")] = None,
) -> int:
    return resolve_persona_id(user, x_persona_id)


CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]
PersonaId = Annotated[int, Depends(get_persona_id)]
