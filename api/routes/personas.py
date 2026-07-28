from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.db import (
    fetchall_dicts,
    fetchone_dict,
    get_db,
    get_user_active_persona_id,
    set_import_target_persona_id,
    set_user_active_persona_id,
)
from api.deps import CurrentUser

router = APIRouter(prefix="/api/personas", tags=["personas"])


class PersonaCreate(BaseModel):
    name: str = ""
    description: Optional[str] = None
    context: Optional[str] = None


class PersonaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    context: Optional[str] = None


class ActiveBody(BaseModel):
    id: int


class ContextBody(BaseModel):
    text: str
    append: bool = False
    source_label: Optional[str] = None


@router.get("")
def list_personas(user: CurrentUser) -> list[dict]:
    db = get_db()
    return fetchall_dicts(
        db,
        """SELECT id, name, description, context, created_at, updated_at
           FROM personas WHERE user_id = ? ORDER BY name COLLATE NOCASE""",
        (user["id"],),
    )


@router.get("/active")
def get_active(user: CurrentUser) -> dict[str, Any]:
    db = get_db()
    user_id = user["id"]
    persona_id = get_user_active_persona_id(db, user_id)
    persona = None
    if persona_id:
        persona = fetchone_dict(
            db,
            """SELECT id, name, description, context, created_at, updated_at
               FROM personas WHERE id = ? AND user_id = ?""",
            (persona_id, user_id),
        )
    return {"id": persona_id, "persona": persona}


@router.post("/active")
def set_active(body: ActiveBody, user: CurrentUser) -> dict[str, Any]:
    db = get_db()
    user_id = user["id"]
    if body.id < 1:
        raise HTTPException(status_code=400, detail="Valid id required")
    try:
        set_user_active_persona_id(db, user_id, body.id)
        set_import_target_persona_id(db, body.id)
        db.commit()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    persona = fetchone_dict(
        db,
        """SELECT id, name, description, context, created_at, updated_at
           FROM personas WHERE id = ? AND user_id = ?""",
        (body.id, user_id),
    )
    return {"id": body.id, "persona": persona}


@router.post("")
def create_persona(body: PersonaCreate, user: CurrentUser) -> dict:
    if not body.name or not isinstance(body.name, str) or not body.name.strip():
        raise HTTPException(status_code=400, detail="name required")
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO personas (name, description, context, user_id) VALUES (?, ?, ?, ?)",
            (
                body.name.strip(),
                body.description.strip() if body.description else None,
                body.context if isinstance(body.context, str) else "",
                user["id"],
            ),
        )
        db.commit()
        row = fetchone_dict(
            db,
            "SELECT id, name, description, context, created_at, updated_at FROM personas WHERE id = ?",
            (cur.lastrowid,),
        )
        return row
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{persona_id}")
def get_persona(persona_id: int, user: CurrentUser) -> dict:
    db = get_db()
    row = fetchone_dict(
        db,
        """SELECT id, name, description, context, created_at, updated_at
           FROM personas WHERE id = ? AND user_id = ?""",
        (persona_id, user["id"]),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return row


@router.put("/{persona_id}")
def update_persona(persona_id: int, body: PersonaUpdate, user: CurrentUser) -> dict:
    db = get_db()
    existing = fetchone_dict(
        db,
        "SELECT * FROM personas WHERE id = ? AND user_id = ?",
        (persona_id, user["id"]),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    name = (
        body.name.strip()
        if body.name is not None and str(body.name).strip()
        else existing["name"]
    )
    description = (
        body.description if body.description is not None else existing["description"]
    )
    context = body.context if body.context is not None else existing["context"]

    db.execute(
        """UPDATE personas SET
             name = ?, description = ?, context = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ?""",
        (name, description, context, persona_id, user["id"]),
    )
    db.commit()
    return fetchone_dict(
        db,
        "SELECT id, name, description, context, created_at, updated_at FROM personas WHERE id = ?",
        (persona_id,),
    )


@router.post("/{persona_id}/context")
def append_context(persona_id: int, body: ContextBody, user: CurrentUser) -> dict:
    db = get_db()
    existing = fetchone_dict(
        db,
        "SELECT * FROM personas WHERE id = ? AND user_id = ?",
        (persona_id, user["id"]),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    if not isinstance(body.text, str):
        raise HTTPException(status_code=400, detail="text string required")

    prev = (existing.get("context") or "").strip()
    if body.append and prev:
        label = f"{body.source_label}\n" if body.source_label else ""
        next_context = f"{prev}\n\n---\n{label}{body.text}"
    else:
        next_context = body.text

    db.execute(
        "UPDATE personas SET context = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        (next_context, persona_id, user["id"]),
    )
    db.commit()
    return fetchone_dict(
        db,
        "SELECT id, name, description, context, created_at, updated_at FROM personas WHERE id = ?",
        (persona_id,),
    )


@router.delete("/{persona_id}")
def delete_persona(persona_id: int, user: CurrentUser) -> dict:
    db = get_db()
    user_id = user["id"]
    total = db.execute(
        "SELECT COUNT(*) AS c FROM personas WHERE user_id = ?",
        (user_id,),
    ).fetchone()["c"]
    if total <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last persona")
    existing = fetchone_dict(
        db,
        "SELECT id FROM personas WHERE id = ? AND user_id = ?",
        (persona_id, user_id),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    active_id = get_user_active_persona_id(db, user_id)
    try:
        db.execute(
            "DELETE FROM personas WHERE id = ? AND user_id = ?",
            (persona_id, user_id),
        )
        if active_id == persona_id:
            nxt = fetchone_dict(
                db,
                "SELECT id FROM personas WHERE user_id = ? ORDER BY id LIMIT 1",
                (user_id,),
            )
            if nxt:
                set_user_active_persona_id(db, user_id, nxt["id"])
                set_import_target_persona_id(db, nxt["id"])
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"ok": True}
