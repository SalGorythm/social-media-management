import { Router } from "express";
import { getDb, getUserActivePersonaId, setUserActivePersonaId, setImportTargetPersonaId } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, description, context, created_at, updated_at FROM personas WHERE user_id = ? ORDER BY name COLLATE NOCASE`
    )
    .all(req.user.id);
  res.json(rows);
});

router.get("/active", (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const id = getUserActivePersonaId(db, userId);
  const persona = id
    ? db
        .prepare(
          `SELECT id, name, description, context, created_at, updated_at FROM personas WHERE id = ? AND user_id = ?`
        )
        .get(id, userId)
    : null;
  res.json({ id: id ?? null, persona });
});

router.post("/active", (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const id = Number(req.body?.id);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "Valid id required" });
  }
  try {
    setUserActivePersonaId(db, userId, id);
    setImportTargetPersonaId(db, id);
    const persona = db
      .prepare(
        `SELECT id, name, description, context, created_at, updated_at FROM personas WHERE id = ? AND user_id = ?`
      )
      .get(id, userId);
    res.json({ id, persona });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/", (req, res) => {
  const db = getDb();
  const { name, description, context } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name required" });
  }
  try {
    const info = db
      .prepare(`INSERT INTO personas (name, description, context, user_id) VALUES (?, ?, ?, ?)`)
      .run(name.trim(), description?.trim() ?? null, typeof context === "string" ? context : "", req.user.id);
    const row = db
      .prepare(`SELECT id, name, description, context, created_at, updated_at FROM personas WHERE id = ?`)
      .get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/:id", (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const row = db
    .prepare(
      `SELECT id, name, description, context, created_at, updated_at FROM personas WHERE id = ? AND user_id = ?`
    )
    .get(id, req.user.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.put("/:id", (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM personas WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { name, description, context } = req.body;
  db.prepare(
    `UPDATE personas SET
      name = COALESCE(?, name),
      description = ?,
      context = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?`
  ).run(
    name != null && String(name).trim() ? String(name).trim() : existing.name,
    description !== undefined ? description : existing.description,
    context !== undefined ? context : existing.context,
    id,
    req.user.id
  );
  const row = db
    .prepare(`SELECT id, name, description, context, created_at, updated_at FROM personas WHERE id = ?`)
    .get(id);
  res.json(row);
});

router.post("/:id/context", (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM personas WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { text, append, source_label } = req.body ?? {};
  if (typeof text !== "string") {
    return res.status(400).json({ error: "text string required" });
  }

  const prev = (existing.context || "").trim();
  let nextContext;
  if (append && prev) {
    const label = source_label ? `${source_label}\n` : "";
    nextContext = `${prev}\n\n---\n${label}${text}`;
  } else {
    nextContext = text;
  }

  db.prepare(`UPDATE personas SET context = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`).run(
    nextContext,
    id,
    req.user.id
  );

  const row = db
    .prepare(`SELECT id, name, description, context, created_at, updated_at FROM personas WHERE id = ?`)
    .get(id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const id = Number(req.params.id);
  const total = db.prepare("SELECT COUNT(*) AS c FROM personas WHERE user_id = ?").get(userId).c;
  if (total <= 1) {
    return res.status(400).json({ error: "Cannot delete the last persona" });
  }
  const existing = db.prepare("SELECT id FROM personas WHERE id = ? AND user_id = ?").get(id, userId);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const activeId = getUserActivePersonaId(db, userId);
  db.transaction(() => {
    db.prepare("DELETE FROM personas WHERE id = ? AND user_id = ?").run(id, userId);
    if (activeId === id) {
      const next = db.prepare("SELECT id FROM personas WHERE user_id = ? ORDER BY id LIMIT 1").get(userId);
      if (next) {
        setUserActivePersonaId(db, userId, next.id);
        setImportTargetPersonaId(db, next.id);
      }
    }
  })();

  res.json({ ok: true });
});

export default router;
