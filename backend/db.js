import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getRepoRoot() {
  return path.resolve(__dirname, "..");
}

export function getPaths() {
  const root = getRepoRoot();
  return {
    root,
    dataDir: path.join(root, "data"),
    dbFile: path.join(root, "data", "studio.db"),
    contentQueue: path.join(root, "content-queue"),
    contentArchive: path.join(root, "content-archive"),
  };
}

function ensureDirs(paths) {
  for (const dir of [paths.dataDir, paths.contentQueue, paths.contentArchive]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function columnExists(db, table, col) {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM pragma_table_info(?) WHERE name = ?`)
    .get(table, col);
  return row && row.c > 0;
}

function tableExists(db, name) {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(name);
  return !!row;
}

function migrateAccountsPersona(db) {
  const defaultPersona = db.prepare("SELECT id FROM personas ORDER BY id LIMIT 1").get();
  const defaultId = defaultPersona?.id ?? 1;

  db.pragma("foreign_keys = OFF");
  try {
    db.exec(`
      CREATE TABLE accounts_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        persona_id INTEGER NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        product TEXT NOT NULL,
        type TEXT DEFAULT 'product',
        platforms TEXT NOT NULL,
        tone TEXT,
        frequency TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(persona_id, name)
      );
      INSERT INTO accounts_new (id, persona_id, name, product, type, platforms, tone, frequency, notes, created_at)
      SELECT id, ${defaultId}, name, product, type, platforms, tone, frequency, notes, created_at FROM accounts;
      DROP TABLE accounts;
      ALTER TABLE accounts_new RENAME TO accounts;
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_accounts_persona ON accounts(persona_id)`);
  } finally {
    db.pragma("foreign_keys = ON");
  }

  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES ('active_persona_id', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(defaultId));
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS personas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      context TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (!columnExists(db, "personas", "user_id")) {
    db.exec(`ALTER TABLE personas ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
  }

  const personaCount = db.prepare("SELECT COUNT(*) AS c FROM personas").get().c;
  if (personaCount === 0) {
    db.prepare(
      `INSERT INTO personas (name, description, context) VALUES (?, ?, ?)`
    ).run(
      "Default",
      "Your first workspace. Create more personas for other apps or products.",
      ""
    );
  }

  const hasAccounts = tableExists(db, "accounts");
  if (!hasAccounts) {
    db.exec(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        persona_id INTEGER NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        product TEXT NOT NULL,
        type TEXT DEFAULT 'product',
        platforms TEXT NOT NULL,
        tone TEXT,
        frequency TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(persona_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_accounts_persona ON accounts(persona_id);
    `);
  } else if (!columnExists(db, "accounts", "persona_id")) {
    migrateAccountsPersona(db);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      post_type TEXT NOT NULL,
      caption TEXT NOT NULL,
      hashtags TEXT,
      image_prompt TEXT,
      image_path TEXT,
      video_idea TEXT,
      posting_tip TEXT,
      status TEXT DEFAULT 'pending',
      scheduled_date TEXT,
      source_file TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS post_status_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_posts_account ON posts(account_id);
    CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
    CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
    CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_events_post ON post_status_events(post_id);
    CREATE INDEX IF NOT EXISTS idx_events_created ON post_status_events(created_at);
  `);

  const firstPersona = db.prepare("SELECT id FROM personas ORDER BY id LIMIT 1").get();
  const activeRow = db.prepare("SELECT value FROM app_settings WHERE key = 'active_persona_id'").get();
  if (!activeRow && firstPersona) {
    db.prepare(`INSERT INTO app_settings (key, value) VALUES ('active_persona_id', ?)`).run(
      String(firstPersona.id)
    );
  }
}

export function getActivePersonaId(db) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'active_persona_id'").get();
  if (row?.value) {
    const id = Number(row.value);
    if (Number.isFinite(id) && id > 0) {
      const exists = db.prepare("SELECT id FROM personas WHERE id = ?").get(id);
      if (exists) return id;
    }
  }
  const first = db.prepare("SELECT id FROM personas ORDER BY id LIMIT 1").get();
  return first?.id ?? 1;
}

export function setActivePersonaId(db, personaId) {
  const exists = db.prepare("SELECT id FROM personas WHERE id = ?").get(personaId);
  if (!exists) throw new Error("Persona not found");
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES ('active_persona_id', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(personaId));
}

export function userActivePersonaKey(userId) {
  return `user:${userId}:active_persona`;
}

export function getUserActivePersonaId(db, userId) {
  const key = userActivePersonaKey(userId);
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
  if (row?.value) {
    const id = Number(row.value);
    if (Number.isFinite(id) && id > 0) {
      const exists = db
        .prepare("SELECT id FROM personas WHERE id = ? AND user_id = ?")
        .get(id, userId);
      if (exists) return id;
    }
  }
  const first = db
    .prepare("SELECT id FROM personas WHERE user_id = ? ORDER BY id LIMIT 1")
    .get(userId);
  return first?.id ?? null;
}

export function setUserActivePersonaId(db, userId, personaId) {
  const exists = db.prepare("SELECT id FROM personas WHERE id = ? AND user_id = ?").get(personaId, userId);
  if (!exists) throw new Error("Persona not found");
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(userActivePersonaKey(userId), String(personaId));
  setActivePersonaId(db, personaId);
}

export function setImportTargetPersonaId(db, personaId) {
  const exists = db.prepare("SELECT id FROM personas WHERE id = ?").get(personaId);
  if (!exists) throw new Error("Persona not found");
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES ('import:target_persona', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(personaId));
}

export function getImportPersonaId(db) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'import:target_persona'").get();
  if (row?.value) {
    const id = Number(row.value);
    if (Number.isFinite(id) && id > 0) {
      const exists = db.prepare("SELECT id FROM personas WHERE id = ?").get(id);
      if (exists) return id;
    }
  }
  return getActivePersonaId(db);
}

export function seedAccountsForPersona(db, personaId) {
  const total = db.prepare("SELECT COUNT(*) AS c FROM accounts WHERE persona_id = ?").get(personaId).c;
  if (total > 0) return;

  const insert = db.prepare(`
    INSERT INTO accounts (persona_id, name, product, type, platforms, tone, frequency, notes)
    VALUES (@persona_id, @name, @product, @type, @platforms, @tone, @frequency, @notes)
  `);

  insert.run({
    persona_id: personaId,
    name: "@easysalahapp",
    product: "Easy Salah Islamic prayer iOS app",
    type: "product",
    platforms: JSON.stringify(["instagram", "threads", "x"]),
    tone: "inspiring & motivational",
    frequency: "daily",
    notes: "Muslim audience; peak engagement around prayer times and Jumuah.",
  });

  insert.run({
    persona_id: personaId,
    name: "@mystudioapps",
    product: "General apps brand account",
    type: "brand",
    platforms: JSON.stringify(["instagram", "x"]),
    tone: "tech-forward & clean",
    frequency: "twice_a_week",
    notes: "Cross-promote app launches and dev updates.",
  });
}

function seedAccounts(db) {
  const personaId = getActivePersonaId(db);
  seedAccountsForPersona(db, personaId);
}

let singleton = null;

export function getDb() {
  if (singleton) return singleton;
  const paths = getPaths();
  ensureDirs(paths);
  singleton = new Database(paths.dbFile);
  singleton.pragma("journal_mode = WAL");
  migrate(singleton);
  seedAccounts(singleton);
  return singleton;
}

export function logStatusChange(db, postId, fromStatus, toStatus) {
  db.prepare(
    `INSERT INTO post_status_events (post_id, from_status, to_status) VALUES (?, ?, ?)`
  ).run(postId, fromStatus ?? null, toStatus);
}
