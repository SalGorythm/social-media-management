from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.db import fetchall_dicts, fetchone_dict, get_db, log_status_change
from api.deps import CurrentUser, PersonaId

router = APIRouter(prefix="/api/posts", tags=["posts"])


class PostUpdate(BaseModel):
    caption: Optional[str] = None
    hashtags: Optional[Any] = None
    status: Optional[str] = None
    scheduled_date: Optional[str] = None
    image_path: Optional[str] = None
    image_prompt: Optional[str] = None
    video_idea: Optional[str] = None
    posting_tip: Optional[str] = None
    platform: Optional[str] = None
    post_type: Optional[str] = None


def parse_hashtags(text: Any) -> list:
    if text is None:
        return []
    if isinstance(text, list):
        return text
    try:
        v = json.loads(text)
        return v if isinstance(v, list) else []
    except Exception:
        return []


def row_to_post(row: Optional[dict]) -> Optional[dict]:
    if not row:
        return None
    return {**row, "hashtags": parse_hashtags(row.get("hashtags"))}


def set_status(db, post_id: int, next_status: str) -> dict:
    post = fetchone_dict(db, "SELECT id, status FROM posts WHERE id = ?", (post_id,))
    if not post:
        return {"ok": False}
    if post["status"] == next_status:
        return {
            "ok": True,
            "post": fetchone_dict(
                db,
                """SELECT p.*, a.name AS account_name FROM posts p
                   JOIN accounts a ON a.id = p.account_id WHERE p.id = ?""",
                (post_id,),
            ),
        }
    db.execute(
        "UPDATE posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (next_status, post_id),
    )
    log_status_change(db, post_id, post["status"], next_status)
    updated = fetchone_dict(
        db,
        """SELECT p.*, a.name AS account_name FROM posts p
           JOIN accounts a ON a.id = p.account_id WHERE p.id = ?""",
        (post_id,),
    )
    return {"ok": True, "post": updated}


@router.get("")
def list_posts(
    _user: CurrentUser,
    persona_id: PersonaId,
    status: Optional[str] = None,
    exclude_status: Optional[str] = None,
    account_id: Optional[int] = None,
    platform: Optional[str] = None,
    post_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> list[dict]:
    db = get_db()
    clauses = ["a.persona_id = ?"]
    params: list[Any] = [persona_id]

    if status:
        clauses.append("p.status = ?")
        params.append(status)
    if exclude_status:
        for value in [s.strip() for s in exclude_status.split(",") if s.strip()]:
            clauses.append("p.status != ?")
            params.append(value)
    if account_id is not None:
        clauses.append("p.account_id = ?")
        params.append(account_id)
    if platform:
        clauses.append("p.platform = ?")
        params.append(platform)
    if post_type:
        clauses.append("p.post_type = ?")
        params.append(post_type)
    if date_from and date_to:
        clauses.append(
            "p.scheduled_date IS NOT NULL AND p.scheduled_date >= ? AND p.scheduled_date <= ?"
        )
        params.extend([date_from, date_to])
    elif date_from:
        clauses.append("p.scheduled_date IS NOT NULL AND p.scheduled_date >= ?")
        params.append(date_from)
    elif date_to:
        clauses.append("p.scheduled_date IS NOT NULL AND p.scheduled_date <= ?")
        params.append(date_to)

    sql = f"""
      SELECT p.*, a.name AS account_name
      FROM posts p
      JOIN accounts a ON a.id = p.account_id
      WHERE {" AND ".join(clauses)}
      ORDER BY datetime(p.created_at) DESC
    """
    rows = fetchall_dicts(db, sql, tuple(params))
    return [row_to_post(r) for r in rows]


@router.get("/{post_id}")
def get_post(post_id: int, _user: CurrentUser, persona_id: PersonaId) -> dict:
    db = get_db()
    row = fetchone_dict(
        db,
        """SELECT p.*, a.name AS account_name
           FROM posts p JOIN accounts a ON a.id = p.account_id
           WHERE p.id = ? AND a.persona_id = ?""",
        (post_id, persona_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return row_to_post(row)


@router.put("/{post_id}")
def update_post(
    post_id: int,
    body: PostUpdate,
    _user: CurrentUser,
    persona_id: PersonaId,
) -> dict:
    db = get_db()
    existing = fetchone_dict(
        db,
        """SELECT p.* FROM posts p
           JOIN accounts a ON a.id = p.account_id
           WHERE p.id = ? AND a.persona_id = ?""",
        (post_id, persona_id),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")

    if body.hashtags is None:
        hashtags_str = existing["hashtags"]
    elif isinstance(body.hashtags, str):
        hashtags_str = body.hashtags
    else:
        hashtags_str = json.dumps(body.hashtags)

    next_status = body.status if body.status is not None else existing["status"]
    if next_status != existing["status"]:
        log_status_change(db, post_id, existing["status"], next_status)

    db.execute(
        """UPDATE posts SET
             caption = ?, hashtags = ?, status = ?, scheduled_date = ?,
             image_path = ?, image_prompt = ?, video_idea = ?, posting_tip = ?,
             platform = ?, post_type = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?""",
        (
            body.caption if body.caption is not None else existing["caption"],
            hashtags_str,
            next_status,
            body.scheduled_date
            if body.scheduled_date is not None
            else existing["scheduled_date"],
            body.image_path if body.image_path is not None else existing["image_path"],
            body.image_prompt
            if body.image_prompt is not None
            else existing["image_prompt"],
            body.video_idea if body.video_idea is not None else existing["video_idea"],
            body.posting_tip if body.posting_tip is not None else existing["posting_tip"],
            body.platform if body.platform is not None else existing["platform"],
            body.post_type if body.post_type is not None else existing["post_type"],
            post_id,
        ),
    )
    db.commit()
    row = fetchone_dict(
        db,
        """SELECT p.*, a.name AS account_name FROM posts p
           JOIN accounts a ON a.id = p.account_id
           WHERE p.id = ? AND a.persona_id = ?""",
        (post_id, persona_id),
    )
    return row_to_post(row)


@router.delete("/{post_id}")
def delete_post(post_id: int, _user: CurrentUser, persona_id: PersonaId) -> dict:
    db = get_db()
    info = db.execute(
        """DELETE FROM posts WHERE id = ? AND account_id IN
           (SELECT id FROM accounts WHERE persona_id = ?)""",
        (post_id, persona_id),
    )
    db.commit()
    if info.rowcount == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


def _status_action(post_id: int, persona_id: int, status: str) -> dict:
    db = get_db()
    belongs = fetchone_dict(
        db,
        """SELECT p.id FROM posts p JOIN accounts a ON a.id = p.account_id
           WHERE p.id = ? AND a.persona_id = ?""",
        (post_id, persona_id),
    )
    if not belongs:
        raise HTTPException(status_code=404, detail="Not found")
    result = set_status(db, post_id, status)
    db.commit()
    if not result["ok"]:
        raise HTTPException(status_code=404, detail="Not found")
    return row_to_post(result["post"])


@router.post("/{post_id}/approve")
def approve(post_id: int, _user: CurrentUser, persona_id: PersonaId) -> dict:
    return _status_action(post_id, persona_id, "approved")


@router.post("/{post_id}/posted")
def mark_posted(post_id: int, _user: CurrentUser, persona_id: PersonaId) -> dict:
    return _status_action(post_id, persona_id, "posted")


@router.post("/{post_id}/reject")
def reject(post_id: int, _user: CurrentUser, persona_id: PersonaId) -> dict:
    return _status_action(post_id, persona_id, "rejected")
