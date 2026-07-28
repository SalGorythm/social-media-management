import { Router } from "express";
import { getDb } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;

  const totals = db
    .prepare(
      `
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
  `
    )
    .get(personaId);

  const byPlatform = db
    .prepare(
      `
    SELECT p.platform, COUNT(*) AS count
    FROM posts p
    JOIN accounts a ON a.id = p.account_id
    WHERE a.persona_id = ?
      AND p.status != 'posted'
    GROUP BY p.platform
    ORDER BY count DESC
  `
    )
    .all(personaId);

  const byAccount = db
    .prepare(
      `
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
  `
    )
    .all(personaId);

  const postedThisWeek = db
    .prepare(
      `
    SELECT COUNT(*) AS c FROM posts p
    JOIN accounts a ON a.id = p.account_id
    WHERE a.persona_id = ?
      AND p.status = 'posted'
      AND date(p.updated_at) >= date('now', '-7 days')
  `
    )
    .get(personaId).c;

  const byPlatformObj = {};
  for (const r of byPlatform) {
    byPlatformObj[r.platform] = r.count;
  }

  res.json({
    total: Number(totals.total) || 0,
    total_pipeline: Number(totals.total_pipeline) || 0,
    pending: Number(totals.pending) || 0,
    approved: Number(totals.approved) || 0,
    posted: Number(totals.posted) || 0,
    rejected: Number(totals.rejected) || 0,
    posted_this_week: Number(postedThisWeek) || 0,
    by_platform: byPlatformObj,
    by_account: byAccount.map((r) => ({
      account_id: r.account_id,
      name: r.name,
      total: Number(r.total) || 0,
      pending: Number(r.pending) || 0,
      approved: Number(r.approved) || 0,
      posted: Number(r.posted) || 0,
      rejected: Number(r.rejected) || 0,
    })),
  });
});

router.get("/activity", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;
  const rows = db
    .prepare(
      `
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
  `
    )
    .all(personaId);
  res.json(rows);
});

export default router;
