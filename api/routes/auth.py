from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from api.auth import hash_password, sign_token, verify_password
from api.db import (
    fetchall_dicts,
    fetchone_dict,
    get_db,
    get_user_active_persona_id,
    seed_accounts_for_persona,
    set_import_target_persona_id,
    set_user_active_persona_id,
)
from api.deps import CurrentUser

router = APIRouter(prefix="/api/auth", tags=["auth"])


class AuthCredentials(BaseModel):
    email: str = ""
    password: str = ""


def _persona_row(db, persona_id: Optional[int]) -> Optional[dict]:
    if not persona_id:
        return None
    return fetchone_dict(
        db,
        "SELECT id, name, description, context, created_at, updated_at FROM personas WHERE id = ?",
        (persona_id,),
    )


def _list_personas(db, user_id: int) -> list[dict]:
    return fetchall_dicts(
        db,
        """SELECT id, name, description, context, created_at, updated_at
           FROM personas WHERE user_id = ? ORDER BY name COLLATE NOCASE""",
        (user_id,),
    )


@router.post("/signup")
def signup(body: AuthCredentials, response: Response) -> dict[str, Any]:
    email = (body.email or "").strip().lower()
    password = body.password or ""
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email required")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    db = get_db()
    existing = fetchone_dict(db, "SELECT id FROM users WHERE email = ?", (email,))
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user_count = db.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
    password_hash = hash_password(password)

    try:
        cur = db.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (email, password_hash),
        )
        user_id = int(cur.lastrowid)

        if user_count == 0:
            claimed = db.execute(
                "UPDATE personas SET user_id = ? WHERE user_id IS NULL",
                (user_id,),
            ).rowcount
            if claimed == 0:
                db.execute(
                    "INSERT INTO personas (name, description, context, user_id) VALUES (?, ?, ?, ?)",
                    ("Default", "Your first workspace.", "", user_id),
                )
        else:
            db.execute(
                "INSERT INTO personas (name, description, context, user_id) VALUES (?, ?, ?, ?)",
                ("Default", "Your workspace.", "", user_id),
            )

        row = fetchone_dict(
            db,
            "SELECT id FROM personas WHERE user_id = ? ORDER BY id LIMIT 1",
            (user_id,),
        )
        if not row:
            raise RuntimeError("Persona bootstrap failed")
        persona_id = row["id"]

        set_user_active_persona_id(db, user_id, persona_id)
        set_import_target_persona_id(db, persona_id)
        seed_accounts_for_persona(db, persona_id)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print("[auth] signup", e)
        raise HTTPException(status_code=500, detail=str(e) or "Signup failed")

    user = {"id": user_id, "email": email}
    response.status_code = 201
    return {
        "token": sign_token(user),
        "user": user,
        "personas": _list_personas(db, user_id),
        "activePersonaId": persona_id,
        "persona": _persona_row(db, persona_id),
    }


@router.post("/login")
def login(body: AuthCredentials) -> dict[str, Any]:
    email = (body.email or "").strip().lower()
    password = body.password or ""
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    db = get_db()
    row = fetchone_dict(
        db,
        "SELECT id, email, password_hash FROM users WHERE email = ?",
        (email,),
    )
    if not row or not verify_password(password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = row["id"]
    persona_id = get_user_active_persona_id(db, user_id)
    if not persona_id:
        first = fetchone_dict(
            db,
            "SELECT id FROM personas WHERE user_id = ? ORDER BY id LIMIT 1",
            (user_id,),
        )
        persona_id = first["id"] if first else None
        if persona_id:
            set_user_active_persona_id(db, user_id, persona_id)
    if persona_id:
        set_import_target_persona_id(db, persona_id)
    db.commit()

    user = {"id": user_id, "email": row["email"]}
    return {
        "token": sign_token(user),
        "user": user,
        "personas": _list_personas(db, user_id),
        "activePersonaId": persona_id,
        "persona": _persona_row(db, persona_id) if persona_id else None,
    }


@router.get("/me")
def me(user: CurrentUser) -> dict[str, Any]:
    db = get_db()
    user_id = user["id"]
    row = fetchone_dict(
        db,
        "SELECT id, email, created_at FROM users WHERE id = ?",
        (user_id,),
    )
    if not row:
        raise HTTPException(status_code=401, detail="User not found")

    persona_id = get_user_active_persona_id(db, user_id)
    if not persona_id:
        first = fetchone_dict(
            db,
            "SELECT id FROM personas WHERE user_id = ? ORDER BY id LIMIT 1",
            (user_id,),
        )
        persona_id = first["id"] if first else None
        if persona_id:
            set_user_active_persona_id(db, user_id, persona_id)
    if persona_id:
        set_import_target_persona_id(db, persona_id)
    db.commit()

    return {
        "user": {"id": row["id"], "email": row["email"]},
        "personas": _list_personas(db, user_id),
        "activePersonaId": persona_id,
        "persona": _persona_row(db, persona_id) if persona_id else None,
    }
