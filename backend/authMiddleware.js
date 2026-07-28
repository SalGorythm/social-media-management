import jwt from "jsonwebtoken";

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn("[auth] JWT_SECRET is not set; using insecure dev default");
    return "social-content-studio-dev-secret-change-me";
  }
  return secret;
}

export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const match = typeof auth === "string" ? /^Bearer\s+(.+)$/i.exec(auth.trim()) : null;
  if (!match) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(match[1], getJwtSecret());
    const id = Number(payload.sub);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.user = { id, email: typeof payload.email === "string" ? payload.email : "" };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
