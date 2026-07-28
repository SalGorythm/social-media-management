from __future__ import annotations

from fastapi import APIRouter

from api.db import fetchall_dicts, fetchone_dict, get_db
from api.deps import CurrentUser, PersonaId

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
def stats(_user: CurrentUser, persona_id: PersonaId) -> dict:
    db = get_db()
    totals = fetchone_dict(
        db,
        """
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN p.status != 'posted' THEN 1 ELSE 0 END) AS total_pipeline,
          SUM(CASE WHEN p.status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN p.status = 'approved' THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN p.status = 'posted' THEN 1 ELSE 0 END) AS posted,
          SUM(CASE WHEN p.status = 'rejected' THEN 1 ELSE 0 END) AS rejected
        FROM posts p
        JOIN accounts a ON a.id = p.account_id
        WHERE a.persona_id = ?
        """,
        (persona_id,),
    ) or {}

    by_platform_rows = fetchall_dicts(
        db,
        """
        SELECT p.platform, COUNT(*) AS count
        FROM posts p
        JOIN accounts a ON a.id = p.account_id
        WHERE a.persona_id = ?
          AND p.status != 'posted'
        GROUP BY p.platform
        ORDER BY count DESC
        """,
        (persona_id,),
    )

    by_account = fetchall_dicts(
        db,
        """
        SELECT
          a.id AS account_id,
          a.name,
          COUNT(p.id) AS total,
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

    posted_this_week = fetchone_dict(
        db,
        """
        SELECT COUNT(*) AS c FROM posts p
        JOIN accounts a ON a.id = p.account_id
        WHERE a.persona_id = ?
          AND p.status = 'posted'
          AND date(p.updated_at) >= date('now', '-7 days')
        """,
        (persona_id,),
    )

    by_platform = {r["platform"]: r["count"] for r in by_platform_rows}

    return {
        "total": int(totals.get("total") or 0),
        "total_pipeline": int(totals.get("total_pipeline") or 0),
        "pending": int(totals.get("pending") or 0),
        "approved": int(totals.get("approved") or 0),
        "posted": int(totals.get("posted") or 0),
        "rejected": int(totals.get("rejected") or 0),
        "posted_this_week": int((posted_this_week or {}).get("c") or 0),
        "by_platform": by_platform,
        "by_account": [
            {
                "account_id": r["account_id"],
                "name": r["name"],
                "total": int(r.get("total") or 0),
                "pending": int(r.get("pending") or 0),
                "approved": int(r.get("approved") or 0),
                "posted": int(r.get("posted") or 0),
                "rejected": int(r.get("rejected") or 0),
            }
            for r in by_account
        ],
    }


@router.get("/activity")
def activity(_user: CurrentUser, persona_id: PersonaId) -> list[dict]:
    db = get_db()
    return fetchall_dicts(
        db,
        """
        SELECT
          e.id,
          e.post_id,
          e.from_status,
          e.to_status,
          e.created_at,
          p.platform,
          p.caption,
          a.name AS account_name
        FROM post_status_events e
        JOIN posts p ON p.id = e.post_id
        JOIN accounts a ON a.id = p.account_id
        WHERE a.persona_id = ?
          AND e.to_status != 'posted'
        ORDER BY datetime(e.created_at) DESC
        LIMIT 10
        """,
        (persona_id,),
    )
