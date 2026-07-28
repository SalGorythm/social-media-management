import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  getDb,
  getUserActivePersonaId,
  setUserActivePersonaId,
  setImportTargetPersonaId,
  seedAccountsForPersona,
} from "../db.js";
import { authMiddleware, getJwtSecret } from "../authMiddleware.js";

const router = Router();
const SALT_ROUNDS = 10;
const JWT_EXPIRES = "14d";

function signToken(user) {
  return jwt.sign({ sub: String(user.id), email: user.email }, getJwtSecret(), {
    expiresIn: JWT_EXPIRES,
  });
}

function personaRow(db, id) {
  if (!id) return null;
  return db
    .prepare(
      `SELECT id, name, description, context, created_at, updated_at FROM personas WHERE id = ?`
    )
    .get(id);
}

router.post("/signup", (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const password_hash = bcrypt.hashSync(password, SALT_ROUNDS);

  let userId;
  let personaId;

  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO users (email, password_hash) VALUES (?, ?)`).run(email, password_hash);
    userId = Number(info.lastInsertRowid);

    if (userCount === 0) {
      const claimed = db.prepare(`UPDATE personas SET user_id = ? WHERE user_id IS NULL`).run(userId).changes;
      if (claimed === 0) {
        db.prepare(`INSERT INTO personas (name, description, context, user_id) VALUES (?, ?, ?, ?)`).run(
          "Default",
          "Your first workspace.",
          "",
          userId
        );
      }
    } else {
      db.prepare(`INSERT INTO personas (name, description, context, user_id) VALUES (?, ?, ?, ?)`).run(
        "Default",
        "Your workspace.",
        "",
        userId
      );
    }

    personaId =
      db.prepare(`SELECT id FROM personas WHERE user_id = ? ORDER BY id LIMIT 1`).get(userId)?.id ?? null;
    if (!personaId) throw new Error("Persona bootstrap failed");

    setUserActivePersonaId(db, userId, personaId);
    setImportTargetPersonaId(db, personaId);
    seedAccountsForPersona(db, personaId);
  });

  try {
    tx();
  } catch (e) {
    console.error("[auth] signup", e);
    return res.status(500).json({ error: e.message || "Signup failed" });
  }

  const user = { id: Number(userId), email };
  const token = signToken(user);
  const personas = db
    .prepare(
      `SELECT id, name, description, context, created_at, updated_at FROM personas WHERE user_id = ? ORDER BY name COLLATE NOCASE`
    )
    .all(userId);

  res.status(201).json({
    token,
    user,
    personas,
    activePersonaId: personaId,
    persona: personaRow(db, personaId),
  });
});

router.post("/login", (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const db = getDb();
  const row = db.prepare(`SELECT id, email, password_hash FROM users WHERE email = ?`).get(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const userId = row.id;
  let personaId = getUserActivePersonaId(db, userId);
  if (!personaId) {
    personaId = db.prepare(`SELECT id FROM personas WHERE user_id = ? ORDER BY id LIMIT 1`).get(userId)?.id;
    if (personaId) setUserActivePersonaId(db, userId, personaId);
  }
  if (personaId) setImportTargetPersonaId(db, personaId);

  const user = { id: userId, email: row.email };
  const token = signToken(user);
  const personas = db
    .prepare(
      `SELECT id, name, description, context, created_at, updated_at FROM personas WHERE user_id = ? ORDER BY name COLLATE NOCASE`
    )
    .all(userId);

  res.json({
    token,
    user,
    personas,
    activePersonaId: personaId ?? null,
    persona: personaId ? personaRow(db, personaId) : null,
  });
});

router.get("/me", authMiddleware, (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const row = db.prepare(`SELECT id, email, created_at FROM users WHERE id = ?`).get(userId);
  if (!row) return res.status(401).json({ error: "User not found" });

  let personaId = getUserActivePersonaId(db, userId);
  if (!personaId) {
    personaId = db.prepare(`SELECT id FROM personas WHERE user_id = ? ORDER BY id LIMIT 1`).get(userId)?.id;
    if (personaId) setUserActivePersonaId(db, userId, personaId);
  }
  if (personaId) setImportTargetPersonaId(db, personaId);

  const personas = db
    .prepare(
      `SELECT id, name, description, context, created_at, updated_at FROM personas WHERE user_id = ? ORDER BY name COLLATE NOCASE`
    )
    .all(userId);

  res.json({
    user: { id: row.id, email: row.email },
    personas,
    activePersonaId: personaId ?? null,
    persona: personaId ? personaRow(db, personaId) : null,
  });
});

export default router;
