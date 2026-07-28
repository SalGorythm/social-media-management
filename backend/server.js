import express from "express";
import cors from "cors";
import { getDb, setImportTargetPersonaId } from "./db.js";
import { authMiddleware } from "./authMiddleware.js";
import { personaScopeMiddleware } from "./personaScope.js";
import { parseQueueDir, startQueueWatcher } from "./parser.js";
import accountsRouter from "./routes/accounts.js";
import postsRouter from "./routes/posts.js";
import statsRouter from "./routes/stats.js";
import personasRouter from "./routes/personas.js";
import authRouter from "./routes/auth.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);
app.use(express.json());

getDb();

app.use("/api/auth", authRouter);

app.use("/api/personas", authMiddleware, personasRouter);
app.use("/api/accounts", authMiddleware, personaScopeMiddleware, accountsRouter);
app.use("/api/posts", authMiddleware, personaScopeMiddleware, postsRouter);
app.use("/api/stats", authMiddleware, personaScopeMiddleware, statsRouter);

app.post("/api/parse", authMiddleware, personaScopeMiddleware, (req, res) => {
  try {
    setImportTargetPersonaId(getDb(), req.personaId);
    const out = parseQueueDir(req.personaId);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

startQueueWatcher((result) => {
  if (!result.ok) {
    console.warn("[watch] parse result:", result);
  }
});

app.listen(PORT, () => {
  console.log(`Social Content Studio API http://localhost:${PORT}`);
});
