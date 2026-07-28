import { Router } from "express";
import { getDb } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;
  const rows = db
    .prepare(
      `
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
  `
    )
    .all(personaId);

  const parsed = rows.map((r) => ({
    ...r,
    platforms: safeJsonArray(r.platforms),
    total_posts: Number(r.total_posts) || 0,
    pending: Number(r.pending) || 0,
    approved: Number(r.approved) || 0,
    posted: Number(r.posted) || 0,
    rejected: Number(r.rejected) || 0,
  }));

  res.json(parsed);
});

router.post("/", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;
  const { name, product, type, platforms, tone, frequency, notes } = req.body;
  if (!name || !product) {
    return res.status(400).json({ error: "name and product required" });
  }
  const platformsJson =
    typeof platforms === "string" ? platforms : JSON.stringify(platforms ?? []);
  try {
    const info = db
      .prepare(
        `INSERT INTO accounts (persona_id, name, product, type, platforms, tone, frequency, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        personaId,
        name,
        product,
        type || "product",
        platformsJson,
        tone ?? null,
        frequency ?? null,
        notes ?? null
      );
    const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ ...row, platforms: safeJsonArray(row.platforms) });
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Account name already exists for this persona" });
    }
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;
  const id = Number(req.params.id);
  const existing = db
    .prepare("SELECT * FROM accounts WHERE id = ? AND persona_id = ?")
    .get(id, personaId);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { name, product, type, platforms, tone, frequency, notes } = req.body;
  const platformsJson =
    platforms === undefined
      ? existing.platforms
      : typeof platforms === "string"
        ? platforms
        : JSON.stringify(platforms);

  try {
    db.prepare(
      `UPDATE accounts SET
        name = COALESCE(?, name),
        product = COALESCE(?, product),
        type = COALESCE(?, type),
        platforms = COALESCE(?, platforms),
        tone = ?,
        frequency = ?,
        notes = ?
      WHERE id = ? AND persona_id = ?`
    ).run(
      name ?? existing.name,
      product ?? existing.product,
      type ?? existing.type,
      platformsJson,
      tone !== undefined ? tone : existing.tone,
      frequency !== undefined ? frequency : existing.frequency,
      notes !== undefined ? notes : existing.notes,
      id,
      personaId
    );
    const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
    res.json({ ...row, platforms: safeJsonArray(row.platforms) });
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Account name already exists for this persona" });
    }
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  const personaId = req.personaId;
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT id FROM accounts WHERE id = ? AND persona_id = ?").get(id, personaId);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM posts WHERE account_id = ?").run(id);
    return db.prepare("DELETE FROM accounts WHERE id = ? AND persona_id = ?").run(id, personaId);
  });
  const info = tx();
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

function safeJsonArray(text) {
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default router;
