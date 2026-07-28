import { getDb, getUserActivePersonaId } from "./db.js";

/**
 * Resolves persona for API requests: X-Persona-Id must belong to req.user when set;
 * otherwise the user's active persona from app_settings.
 */
export function getPersonaIdFromRequest(req) {
  const db = getDb();
  const userId = req.user?.id;
  if (!userId) return null;

  const raw = req.header("X-Persona-Id");
  if (raw != null && raw !== "") {
    const id = Number(raw);
    if (Number.isFinite(id) && id > 0) {
      const row = db.prepare("SELECT id FROM personas WHERE id = ? AND user_id = ?").get(id, userId);
      if (row) return id;
    }
  }
  const pid = getUserActivePersonaId(db, userId);
  if (!pid) {
    const err = new Error("NO_PERSONA");
    throw err;
  }
  return pid;
}

export function personaScopeMiddleware(req, res, next) {
  try {
    req.personaId = getPersonaIdFromRequest(req);
    next();
  } catch (e) {
    if (e?.message === "NO_PERSONA") {
      return res.status(400).json({ error: "No workspace persona. Create one under Personas." });
    }
    next(e);
  }
}
