from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api.crypto import decrypt_secret, encrypt_secret, mask_secret
from api.db import fetchall_dicts, fetchone_dict, get_db, get_paths, set_import_target_persona_id
from api.deps import CurrentUser, PersonaId
from api.llm import PROVIDERS, generate_queue_json, provider_catalog
from api.parser import parse_file

router = APIRouter(prefix="/api/llm", tags=["llm"])


class KeyUpsert(BaseModel):
    api_key: str = Field(min_length=1)
    model: Optional[str] = None


class GenerateBody(BaseModel):
    account_id: int
    provider: str
    model: Optional[str] = None
    post_count: int = Field(default=5, ge=1, le=20)
    extra_instructions: str = ""


def _default_provider_key(user_id: int) -> str:
    return f"user:{user_id}:default_llm_provider"


@router.get("/providers")
def list_providers(user: CurrentUser) -> dict[str, Any]:
    db = get_db()
    rows = fetchall_dicts(
        db,
        "SELECT provider, model, updated_at FROM user_llm_keys WHERE user_id = ?",
        (user["id"],),
    )
    configured = {r["provider"]: r for r in rows}
    default_row = fetchone_dict(
        db,
        "SELECT value FROM app_settings WHERE key = ?",
        (_default_provider_key(user["id"]),),
    )
    default_provider = default_row["value"] if default_row else None

    providers = []
    for meta in provider_catalog():
        conf = configured.get(meta["id"])
        key_row = None
        if conf:
            enc = fetchone_dict(
                db,
                "SELECT api_key_enc FROM user_llm_keys WHERE user_id = ? AND provider = ?",
                (user["id"], meta["id"]),
            )
            hint = ""
            if enc:
                try:
                    hint = mask_secret(decrypt_secret(enc["api_key_enc"]))
                except ValueError:
                    hint = "(unreadable — re-save key)"
            key_row = {
                "configured": True,
                "model": conf.get("model") or meta["default_model"],
                "updated_at": conf.get("updated_at"),
                "key_hint": hint,
            }
        else:
            key_row = {
                "configured": False,
                "model": meta["default_model"],
                "updated_at": None,
                "key_hint": None,
            }
        providers.append({**meta, **key_row})

    return {
        "providers": providers,
        "default_provider": default_provider,
        "cursor_workflow": {
            "label": "Cursor / Claude / Copilot (IDE)",
            "description": "Copy the account prompt and paste into Cursor or another IDE assistant; save JSON into content-queue. No API key required in this app.",
        },
    }


@router.put("/providers/{provider}")
def upsert_provider(provider: str, body: KeyUpsert, user: CurrentUser) -> dict:
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
    key = body.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="api_key required")
    model = (body.model or "").strip() or PROVIDERS[provider]["default_model"]
    enc = encrypt_secret(key)
    db = get_db()
    db.execute(
        """INSERT INTO user_llm_keys (user_id, provider, api_key_enc, model, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, provider) DO UPDATE SET
             api_key_enc = excluded.api_key_enc,
             model = excluded.model,
             updated_at = CURRENT_TIMESTAMP""",
        (user["id"], provider, enc, model),
    )
    # Set as default if user has none
    pref = fetchone_dict(
        db,
        "SELECT value FROM app_settings WHERE key = ?",
        (_default_provider_key(user["id"]),),
    )
    if not pref:
        db.execute(
            """INSERT INTO app_settings (key, value) VALUES (?, ?)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
            (_default_provider_key(user["id"]), provider),
        )
    db.commit()
    return {
        "ok": True,
        "provider": provider,
        "model": model,
        "key_hint": mask_secret(key),
        "configured": True,
    }


@router.delete("/providers/{provider}")
def delete_provider(provider: str, user: CurrentUser) -> dict:
    db = get_db()
    info = db.execute(
        "DELETE FROM user_llm_keys WHERE user_id = ? AND provider = ?",
        (user["id"], provider),
    )
    db.commit()
    if info.rowcount == 0:
        raise HTTPException(status_code=404, detail="Not found")
    pref = fetchone_dict(
        db,
        "SELECT value FROM app_settings WHERE key = ?",
        (_default_provider_key(user["id"]),),
    )
    if pref and pref["value"] == provider:
        db.execute(
            "DELETE FROM app_settings WHERE key = ?",
            (_default_provider_key(user["id"]),),
        )
        db.commit()
    return {"ok": True}


class DefaultBody(BaseModel):
    provider: str


@router.post("/default")
def set_default(body: DefaultBody, user: CurrentUser) -> dict:
    if body.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider")
    db = get_db()
    exists = fetchone_dict(
        db,
        "SELECT provider FROM user_llm_keys WHERE user_id = ? AND provider = ?",
        (user["id"], body.provider),
    )
    if not exists:
        raise HTTPException(status_code=400, detail="Configure this provider first")
    db.execute(
        """INSERT INTO app_settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
        (_default_provider_key(user["id"]), body.provider),
    )
    db.commit()
    return {"ok": True, "default_provider": body.provider}


@router.post("/generate")
def generate_posts(body: GenerateBody, user: CurrentUser, persona_id: PersonaId) -> dict:
    if body.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {body.provider}")

    db = get_db()
    account = fetchone_dict(
        db,
        "SELECT * FROM accounts WHERE id = ? AND persona_id = ?",
        (body.account_id, persona_id),
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    key_row = fetchone_dict(
        db,
        "SELECT api_key_enc, model FROM user_llm_keys WHERE user_id = ? AND provider = ?",
        (user["id"], body.provider),
    )
    if not key_row:
        raise HTTPException(
            status_code=400,
            detail=f"No API key for {body.provider}. Add one under AI settings.",
        )

    try:
        api_key = decrypt_secret(key_row["api_key_enc"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    model = body.model or key_row.get("model")

    try:
        platforms = json.loads(account["platforms"]) if account.get("platforms") else []
    except Exception:
        platforms = []
    account_view = {**account, "platforms": platforms}

    try:
        queue = generate_queue_json(
            body.provider,
            api_key,
            model,
            account_view,
            body.post_count,
            body.extra_instructions,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    paths = get_paths()
    queue_dir = Path(paths["content_queue"])
    queue_dir.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^a-zA-Z0-9_-]+", "_", (account["name"] or "account").lstrip("@"))
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"{stamp}_{safe}_{body.provider}_batch.json"
    dest = queue_dir / filename
    dest.write_text(json.dumps(queue, indent=2), encoding="utf-8")

    set_import_target_persona_id(db, persona_id)
    db.commit()
    result = parse_file(dest, persona_id)
    if not result.get("ok"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error") or "Generated file failed validation/import",
        )

    return {
        "ok": True,
        "file": filename,
        "import": result,
        "post_count": result.get("count", 0),
        "provider": body.provider,
        "model": model or PROVIDERS[body.provider]["default_model"],
    }
