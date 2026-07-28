from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Optional

from api.config import get_settings

_db: Optional[sqlite3.Connection] = None


def _row_to_dict(row: Optional[sqlite3.Row]) -> Optional[dict[str, Any]]:
    if row is None:
        return None
    return dict(row)


def get_paths() -> dict:
    s = get_settings()
    return {
        "root": s["repo_root"],
        "data_dir": s["data_dir"],
        "db_file": Path(s["db_path"]),
        "content_queue": s["content_queue"],
        "content_archive": s["content_archive"],
    }


def ensure_dirs() -> None:
    paths = get_paths()
    for d in (paths["data_dir"], paths["content_queue"], paths["content_archive"]):
        Path(d).mkdir(parents=True, exist_ok=True)


def column_exists(db: sqlite3.Connection, table: str, col: str) -> bool:
    row = db.execute(
        "SELECT COUNT(*) AS c FROM pragma_table_info(?) WHERE name = ?",
        (table, col),
    ).fetchone()
    return bool(row and row["c"] > 0)


def table_exists(db: sqlite3.Connection, name: str) -> bool:
    row = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (name,),
    ).fetchone()
    return bool(row)


def migrate_accounts_persona(db: sqlite3.Connection) -> None:
    default = db.execute("SELECT id FROM personas ORDER BY id LIMIT 1").fetchone()
    default_id = default["id"] if default else 1

    db.execute("PRAGMA foreign_keys = OFF")
    try:
        db.executescript(
            f"""
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
            SELECT id, {default_id}, name, product, type, platforms, tone, frequency, notes, created_at FROM accounts;
            DROP TABLE accounts;
            ALTER TABLE accounts_new RENAME TO accounts;
            CREATE INDEX IF NOT EXISTS idx_accounts_persona ON accounts(persona_id);
            """
        )
    finally:
        db.execute("PRAGMA foreign_keys = ON")

    db.execute(
        """INSERT INTO app_settings (key, value) VALUES ('active_persona_id', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
        (str(default_id),),
    )


def migrate(db: sqlite3.Connection) -> None:
    db.executescript(
        """
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
        """
    )

    if not column_exists(db, "personas", "user_id"):
        db.execute(
            "ALTER TABLE personas ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"
        )

    persona_count = db.execute("SELECT COUNT(*) AS c FROM personas").fetchone()["c"]
    if persona_count == 0:
        db.execute(
            "INSERT INTO personas (name, description, context) VALUES (?, ?, ?)",
            (
                "Default",
                "Your first workspace. Create more personas for other apps or products.",
                "",
            ),
        )

    if not table_exists(db, "accounts"):
        db.executescript(
            """
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
            """
        )
    elif not column_exists(db, "accounts", "persona_id"):
        migrate_accounts_persona(db)

    db.executescript(
        """
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

        CREATE TABLE IF NOT EXISTS user_llm_keys (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL,
          api_key_enc TEXT NOT NULL,
          model TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, provider)
        );
        """
    )

    first = db.execute("SELECT id FROM personas ORDER BY id LIMIT 1").fetchone()
    active = db.execute(
        "SELECT value FROM app_settings WHERE key = 'active_persona_id'"
    ).fetchone()
    if not active and first:
        db.execute(
            "INSERT INTO app_settings (key, value) VALUES ('active_persona_id', ?)",
            (str(first["id"]),),
        )


def get_active_persona_id(db: sqlite3.Connection) -> int:
    row = db.execute(
        "SELECT value FROM app_settings WHERE key = 'active_persona_id'"
    ).fetchone()
    if row and row["value"]:
        try:
            pid = int(row["value"])
            if pid > 0 and db.execute(
                "SELECT id FROM personas WHERE id = ?", (pid,)
            ).fetchone():
                return pid
        except ValueError:
            pass
    first = db.execute("SELECT id FROM personas ORDER BY id LIMIT 1").fetchone()
    return first["id"] if first else 1


def set_active_persona_id(db: sqlite3.Connection, persona_id: int) -> None:
    exists = db.execute("SELECT id FROM personas WHERE id = ?", (persona_id,)).fetchone()
    if not exists:
        raise ValueError("Persona not found")
    db.execute(
        """INSERT INTO app_settings (key, value) VALUES ('active_persona_id', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
        (str(persona_id),),
    )


def user_active_persona_key(user_id: int) -> str:
    return f"user:{user_id}:active_persona"


def get_user_active_persona_id(db: sqlite3.Connection, user_id: int) -> Optional[int]:
    key = user_active_persona_key(user_id)
    row = db.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
    if row and row["value"]:
        try:
            pid = int(row["value"])
            if pid > 0 and db.execute(
                "SELECT id FROM personas WHERE id = ? AND user_id = ?",
                (pid, user_id),
            ).fetchone():
                return pid
        except ValueError:
            pass
    first = db.execute(
        "SELECT id FROM personas WHERE user_id = ? ORDER BY id LIMIT 1",
        (user_id,),
    ).fetchone()
    return first["id"] if first else None


def set_user_active_persona_id(db: sqlite3.Connection, user_id: int, persona_id: int) -> None:
    exists = db.execute(
        "SELECT id FROM personas WHERE id = ? AND user_id = ?",
        (persona_id, user_id),
    ).fetchone()
    if not exists:
        raise ValueError("Persona not found")
    db.execute(
        """INSERT INTO app_settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
        (user_active_persona_key(user_id), str(persona_id)),
    )
    set_active_persona_id(db, persona_id)


def set_import_target_persona_id(db: sqlite3.Connection, persona_id: int) -> None:
    exists = db.execute("SELECT id FROM personas WHERE id = ?", (persona_id,)).fetchone()
    if not exists:
        raise ValueError("Persona not found")
    db.execute(
        """INSERT INTO app_settings (key, value) VALUES ('import:target_persona', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
        (str(persona_id),),
    )


def get_import_persona_id(db: sqlite3.Connection) -> int:
    row = db.execute(
        "SELECT value FROM app_settings WHERE key = 'import:target_persona'"
    ).fetchone()
    if row and row["value"]:
        try:
            pid = int(row["value"])
            if pid > 0 and db.execute(
                "SELECT id FROM personas WHERE id = ?", (pid,)
            ).fetchone():
                return pid
        except ValueError:
            pass
    return get_active_persona_id(db)


def seed_accounts_for_persona(db: sqlite3.Connection, persona_id: int) -> None:
    total = db.execute(
        "SELECT COUNT(*) AS c FROM accounts WHERE persona_id = ?",
        (persona_id,),
    ).fetchone()["c"]
    if total > 0:
        return

    db.execute(
        """INSERT INTO accounts (persona_id, name, product, type, platforms, tone, frequency, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            persona_id,
            "@demo_product",
            "Sample product account for demos",
            "product",
            '["instagram", "threads", "x"]',
            "friendly & clear",
            "daily",
            "Replace with your real product handle and audience notes.",
        ),
    )
    db.execute(
        """INSERT INTO accounts (persona_id, name, product, type, platforms, tone, frequency, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            persona_id,
            "@demo_brand",
            "Sample brand account for demos",
            "brand",
            '["instagram", "x"]',
            "tech-forward & clean",
            "twice_a_week",
            "Replace with your brand voice and posting cadence.",
        ),
    )


def seed_accounts(db: sqlite3.Connection) -> None:
    seed_accounts_for_persona(db, get_active_persona_id(db))


def log_status_change(
    db: sqlite3.Connection,
    post_id: int,
    from_status: Optional[str],
    to_status: str,
) -> None:
    db.execute(
        "INSERT INTO post_status_events (post_id, from_status, to_status) VALUES (?, ?, ?)",
        (post_id, from_status, to_status),
    )


def get_db() -> sqlite3.Connection:
    global _db
    if _db is not None:
        return _db
    ensure_dirs()
    paths = get_paths()
    conn = sqlite3.connect(str(paths["db_file"]), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    migrate(conn)
    seed_accounts(conn)
    conn.commit()
    _db = conn
    return _db


@contextmanager
def db_cursor() -> Iterator[sqlite3.Connection]:
    db = get_db()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise


def fetchone_dict(db: sqlite3.Connection, sql: str, params: tuple = ()) -> Optional[dict]:
    return _row_to_dict(db.execute(sql, params).fetchone())


def fetchall_dicts(db: sqlite3.Connection, sql: str, params: tuple = ()) -> list[dict]:
    return [dict(r) for r in db.execute(sql, params).fetchall()]
