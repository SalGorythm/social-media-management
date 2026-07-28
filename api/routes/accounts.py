from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.db import fetchall_dicts, fetchone_dict, get_db
from api.deps import CurrentUser, PersonaId

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


class AccountBody(BaseModel):
    name: Optional[str] = None
    product: Optional[str] = None
    type: Optional[str] = None
    platforms: Optional[Any] = None
    tone: Optional[str] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None


def safe_json_array(text: Any) -> list:
    if text is None:
        return []
    if isinstance(text, list):
        return text
    try:
        v = json.loads(text)
        return v if isinstance(v, list) else []
    except Exception:
        return []


def platforms_to_json(platforms: Any) -> str:
    if isinstance(platforms, str):
        return platforms
    return json.dumps(platforms if platforms is not None else [])


@router.get("")
def list_accounts(_user: CurrentUser, persona_id: PersonaId) -> list[dict]:
    db = get_db()
    rows = fetchall_dicts(
        db,
        """
        SELECT
          a.*,
          COUNT(p.id) AS total_posts,
          SUM(CASE WHEN p.status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN p.status = 'approved' THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN p.status = 'posted' THEN 1 ELSE 0 END) AS posted,
          SUM(CASE WHEN p.status = 'rejected' THEN 1 ELSE 0 END) AS rejected
        FROM accounts a
        LEFT JOIN posts p ON p.account_id = a.id
        WHERE a.persona_id = ?
        GROUP BY a.id
        ORDER BY a.name
        """,
        (persona_id,),
    )
    out = []
    for r in rows:
        out.append(
            {
                **r,
                "platforms": safe_json_array(r.get("platforms")),
                "total_posts": int(r.get("total_posts") or 0),
                "pending": int(r.get("pending") or 0),
                "approved": int(r.get("approved") or 0),
                "posted": int(r.get("posted") or 0),
                "rejected": int(r.get("rejected") or 0),
            }
        )
    return out


@router.post("")
def create_account(body: AccountBody, _user: CurrentUser, persona_id: PersonaId) -> dict:
    if not body.name or not body.product:
        raise HTTPException(status_code=400, detail="name and product required")
    db = get_db()
    try:
        cur = db.execute(
            """INSERT INTO accounts (persona_id, name, product, type, platforms, tone, frequency, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                persona_id,
                body.name,
                body.product,
                body.type or "product",
                platforms_to_json(body.platforms),
                body.tone,
                body.frequency,
                body.notes,
            ),
        )
        db.commit()
        row = fetchone_dict(db, "SELECT * FROM accounts WHERE id = ?", (cur.lastrowid,))
        return {**row, "platforms": safe_json_array(row.get("platforms"))}
    except Exception as e:
        db.rollback()
        if "UNIQUE" in str(e).upper():
            raise HTTPException(
                status_code=409,
                detail="Account name already exists for this persona",
            )
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{account_id}")
def update_account(
    account_id: int,
    body: AccountBody,
    _user: CurrentUser,
    persona_id: PersonaId,
) -> dict:
    db = get_db()
    existing = fetchone_dict(
        db,
        "SELECT * FROM accounts WHERE id = ? AND persona_id = ?",
        (account_id, persona_id),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    platforms_json = (
        existing["platforms"]
        if body.platforms is None
        else platforms_to_json(body.platforms)
    )
    try:
        db.execute(
            """UPDATE accounts SET
                 name = ?, product = ?, type = ?, platforms = ?,
                 tone = ?, frequency = ?, notes = ?
               WHERE id = ? AND persona_id = ?""",
            (
                body.name if body.name is not None else existing["name"],
                body.product if body.product is not None else existing["product"],
                body.type if body.type is not None else existing["type"],
                platforms_json,
                body.tone if body.tone is not None else existing["tone"],
                body.frequency if body.frequency is not None else existing["frequency"],
                body.notes if body.notes is not None else existing["notes"],
                account_id,
                persona_id,
            ),
        )
        db.commit()
        row = fetchone_dict(db, "SELECT * FROM accounts WHERE id = ?", (account_id,))
        return {**row, "platforms": safe_json_array(row.get("platforms"))}
    except Exception as e:
        db.rollback()
        if "UNIQUE" in str(e).upper():
            raise HTTPException(
                status_code=409,
                detail="Account name already exists for this persona",
            )
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{account_id}")
def delete_account(account_id: int, _user: CurrentUser, persona_id: PersonaId) -> dict:
    db = get_db()
    existing = fetchone_dict(
        db,
        "SELECT id FROM accounts WHERE id = ? AND persona_id = ?",
        (account_id, persona_id),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        db.execute("DELETE FROM posts WHERE account_id = ?", (account_id,))
        info = db.execute(
            "DELETE FROM accounts WHERE id = ? AND persona_id = ?",
            (account_id, persona_id),
        )
        db.commit()
        if info.rowcount == 0:
            raise HTTPException(status_code=404, detail="Not found")
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    return {"ok": True}
