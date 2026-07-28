import { Router } from "express";
import { getDb, logStatusChange } from "../db.js";

const router = Router();

function rowToPost(row) {
  if (!row) return null;
  return {
    ...row,
    hashtags: parseHashtags(row.hashtags),
  };
}

function parseHashtags(text) {
  if (text == null) return [];
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function setStatus(db, id, nextStatus) {
  const post = db.prepare("SELECT id, status FROM posts WHERE id = ?").get(id);
  if (!post) return { ok: false, error: "Not found" };
  if (post.status === nextStatus) {
    return {
      ok: true,
      post: db
        .prepare(
          `SELECT p.*, a.name AS account_name FROM posts p JOIN accounts a ON a.id = p.account_id WHERE p.id = ?`
        )
        .get(id),
    };
  }
  db.prepare(
    `UPDATE posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(nextStatus, id);
  logStatusChange(db, id, post.status, nextStatus);
  const updated = db
    .prepare(
      `SELECT p.*, a.name AS account_name FROM posts p JOIN accounts a ON a.id = p.account_id WHERE p.id = ?`
    )
    .get(id);
  return { ok: true, post: updated };
}

router.get("/", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;
  const {
    status,
    exclude_status,
    account_id,
    platform,
    post_type,
    date_from,
    date_to,
  } = req.query;

  const clauses = ["a.persona_id = ?"];
  const params = [personaId];

  if (status) {
    clauses.push("p.status = ?");
    params.push(status);
  }
  if (exclude_status) {
    const excluded = String(exclude_status)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const value of excluded) {
      clauses.push("p.status != ?");
      params.push(value);
    }
  }
  if (account_id) {
    clauses.push("p.account_id = ?");
    params.push(Number(account_id));
  }
  if (platform) {
    clauses.push("p.platform = ?");
    params.push(platform);
  }
  if (post_type) {
    clauses.push("p.post_type = ?");
    params.push(post_type);
  }
  if (date_from && date_to) {
    clauses.push(
      "p.scheduled_date IS NOT NULL AND p.scheduled_date >= ? AND p.scheduled_date <= ?"
    );
    params.push(date_from, date_to);
  } else if (date_from) {
    clauses.push("p.scheduled_date IS NOT NULL AND p.scheduled_date >= ?");
    params.push(date_from);
  } else if (date_to) {
    clauses.push("p.scheduled_date IS NOT NULL AND p.scheduled_date <= ?");
    params.push(date_to);
  }

  const sql = `
    SELECT p.*, a.name AS account_name
    FROM posts p
    JOIN accounts a ON a.id = p.account_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY datetime(p.created_at) DESC
  `;
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(rowToPost));
});

router.get("/:id", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;
  const id = Number(req.params.id);
  const row = db
    .prepare(
      `SELECT p.*, a.name AS account_name
       FROM posts p
       JOIN accounts a ON a.id = p.account_id
       WHERE p.id = ? AND a.persona_id = ?`
    )
    .get(id, personaId);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(rowToPost(row));
});

router.put("/:id", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;
  const id = Number(req.params.id);
  const existing = db
    .prepare(
      `SELECT p.* FROM posts p
       JOIN accounts a ON a.id = p.account_id
       WHERE p.id = ? AND a.persona_id = ?`
    )
    .get(id, personaId);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const {
    caption,
    hashtags,
    status,
    scheduled_date,
    image_path,
    image_prompt,
    video_idea,
    posting_tip,
    platform,
    post_type,
  } = req.body;

  const hashtagsStr =
    hashtags === undefined
      ? existing.hashtags
      : typeof hashtags === "string"
        ? hashtags
        : JSON.stringify(hashtags);

  const nextStatus = status !== undefined ? status : existing.status;
  if (nextStatus !== existing.status) {
    logStatusChange(db, id, existing.status, nextStatus);
  }

  db.prepare(
    `UPDATE posts SET
      caption = COALESCE(?, caption),
      hashtags = COALESCE(?, hashtags),
      status = COALESCE(?, status),
      scheduled_date = ?,
      image_path = ?,
      image_prompt = COALESCE(?, image_prompt),
      video_idea = ?,
      posting_tip = ?,
      platform = COALESCE(?, platform),
      post_type = COALESCE(?, post_type),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  ).run(
    caption ?? existing.caption,
    hashtagsStr,
    status !== undefined ? status : existing.status,
    scheduled_date !== undefined ? scheduled_date : existing.scheduled_date,
    image_path !== undefined ? image_path : existing.image_path,
    image_prompt !== undefined ? image_prompt : existing.image_prompt,
    video_idea !== undefined ? video_idea : existing.video_idea,
    posting_tip !== undefined ? posting_tip : existing.posting_tip,
    platform ?? existing.platform,
    post_type ?? existing.post_type,
    id
  );

  const row = db
    .prepare(
      `SELECT p.*, a.name AS account_name FROM posts p JOIN accounts a ON a.id = p.account_id WHERE p.id = ? AND a.persona_id = ?`
    )
    .get(id, personaId);
  res.json(rowToPost(row));
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;
  const id = Number(req.params.id);
  const info = db
    .prepare(
      `DELETE FROM posts WHERE id = ? AND account_id IN (SELECT id FROM accounts WHERE persona_id = ?)`
    )
    .run(id, personaId);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

router.post("/:id/approve", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;
  const id = Number(req.params.id);
  const belongs = db
    .prepare(
      `SELECT p.id FROM posts p JOIN accounts a ON a.id = p.account_id WHERE p.id = ? AND a.persona_id = ?`
    )
    .get(id, personaId);
  if (!belongs) return res.status(404).json({ error: "Not found" });
  const result = setStatus(db, id, "approved");
  if (!result.ok) return res.status(404).json({ error: "Not found" });
  res.json(rowToPost(result.post));
});

router.post("/:id/posted", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;
  const id = Number(req.params.id);
  const belongs = db
    .prepare(
      `SELECT p.id FROM posts p JOIN accounts a ON a.id = p.account_id WHERE p.id = ? AND a.persona_id = ?`
    )
    .get(id, personaId);
  if (!belongs) return res.status(404).json({ error: "Not found" });
  const result = setStatus(db, id, "posted");
  if (!result.ok) return res.status(404).json({ error: "Not found" });
  res.json(rowToPost(result.post));
});

router.post("/:id/reject", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;
  const id = Number(req.params.id);
  const belongs = db
    .prepare(
      `SELECT p.id FROM posts p JOIN accounts a ON a.id = p.account_id WHERE p.id = ? AND a.persona_id = ?`
    )
    .get(id, personaId);
  if (!belongs) return res.status(404).json({ error: "Not found" });
  const result = setStatus(db, id, "rejected");
  if (!result.ok) return res.status(404).json({ error: "Not found" });
  res.json(rowToPost(result.post));
});

export default router;
