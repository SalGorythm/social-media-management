from __future__ import annotations

import json
import os
import re
import shutil
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from api.db import get_db, get_import_persona_id, get_paths

PLATFORMS = {"instagram", "x", "threads", "facebook", "reddit"}
POST_TYPES = {"post", "story", "reel", "carousel"}
POST_TYPE_ALIASES = {
    "static": "post",
    "image": "post",
    "single": "post",
    "single_post": "post",
    "feed_post": "post",
    "post": "post",
    "carousel": "carousel",
    "reel": "reel",
    "story": "story",
}

_watcher: Optional[Observer] = None
_pending: dict[str, threading.Timer] = {}
_pending_lock = threading.Lock()
STABILITY_MS = 400


def normalize_platform(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    return normalized if normalized in PLATFORMS else None


def normalize_post_type(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = re.sub(r"\s+", "_", value.strip().lower())
    return POST_TYPE_ALIASES.get(normalized)


def normalize_hashtags(value: Any) -> list[str]:
    tags: list[str] = []
    if isinstance(value, list):
        tags = value
    elif isinstance(value, dict):
        for entry in value.values():
            if isinstance(entry, list):
                tags.extend(entry)
    seen = set()
    out = []
    for tag in tags:
        if isinstance(tag, str) and tag.strip():
            t = tag.strip().lstrip("#")
            if t and t not in seen:
                seen.add(t)
                out.append(t)
    return out


def build_feed_posting_tip(post: dict) -> Optional[str]:
    parts = []
    for key, label in (
        ("posting_tip", None),
        ("hook", "Hook"),
        ("cta", "CTA"),
        ("content_category", "Category"),
    ):
        val = post.get(key)
        if isinstance(val, str) and val.strip():
            parts.append(f"{label}: {val.strip()}" if label else val.strip())
    return " | ".join(parts) if parts else None


def build_video_idea(post: dict) -> Optional[str]:
    if isinstance(post.get("video_idea"), str) and post["video_idea"].strip():
        return post["video_idea"].strip()
    script = post.get("reel_script")
    if not isinstance(script, dict):
        return None
    parts = []
    if isinstance(script.get("duration"), str) and script["duration"].strip():
        parts.append(f"Duration: {script['duration'].strip()}")
    scenes = script.get("scenes")
    if isinstance(scenes, list):
        for scene in scenes:
            if not isinstance(scene, dict):
                continue
            second = scene.get("second") if isinstance(scene.get("second"), str) else ""
            visuals = scene.get("visuals") if isinstance(scene.get("visuals"), str) else ""
            overlay = (
                scene.get("text_overlay")
                if isinstance(scene.get("text_overlay"), str)
                else ""
            )
            scene_parts = [p.strip() for p in (second, visuals, overlay) if p and p.strip()]
            if scene_parts:
                parts.append(" - ".join(scene_parts))
    return "\n".join(parts) if parts else None


def describe_interactive_element(el: Any) -> Optional[str]:
    if not isinstance(el, dict):
        return None
    parts = []
    if isinstance(el.get("type"), str) and el["type"].strip():
        parts.append(el["type"].strip())
    if isinstance(el.get("label"), str) and el["label"].strip():
        parts.append(el["label"].strip())
    if isinstance(el.get("options"), list) and el["options"]:
        parts.append(f"Options: {', '.join(str(o) for o in el['options'])}")
    return " | ".join(parts) if parts else None


def build_story_caption(story: dict) -> str:
    parts = []
    if isinstance(story.get("hook"), str) and story["hook"].strip():
        parts.append(story["hook"].strip())
    if isinstance(story.get("overlay_copy"), str) and story["overlay_copy"].strip():
        parts.append(story["overlay_copy"].strip())
    if isinstance(story.get("cta"), str) and story["cta"].strip():
        parts.append(f"CTA: {story['cta'].strip()}")
    return "\n\n".join(parts)


def build_story_posting_tip(story: dict) -> Optional[str]:
    parts = []
    if isinstance(story.get("objective"), str) and story["objective"].strip():
        parts.append(f"Objective: {story['objective'].strip()}")
    interactive = describe_interactive_element(story.get("interactive_element"))
    if interactive:
        parts.append(f"Interactive: {interactive}")
    if story.get("related_post_day") is not None:
        parts.append(f"Related post day: {story['related_post_day']}")
    return " | ".join(parts) if parts else None


def validate_normalized_post(post: dict, index: int, collection: str) -> dict:
    if not isinstance(post, dict):
        return {"ok": False, "error": f"{collection}[{index}] invalid"}
    if post.get("platform") not in PLATFORMS:
        return {"ok": False, "error": f"{collection}[{index}].platform invalid"}
    if post.get("post_type") not in POST_TYPES:
        return {"ok": False, "error": f"{collection}[{index}].post_type invalid"}
    if not isinstance(post.get("caption"), str) or not post["caption"].strip():
        return {"ok": False, "error": f"{collection}[{index}].caption must be string"}
    if not isinstance(post.get("hashtags"), list):
        return {"ok": False, "error": f"{collection}[{index}].hashtags must be array"}
    if post.get("image_prompt") is not None and not isinstance(post["image_prompt"], str):
        return {"ok": False, "error": f"{collection}[{index}].image_prompt invalid"}
    if post.get("scheduled_date") is not None and not isinstance(
        post["scheduled_date"], str
    ):
        return {"ok": False, "error": f"{collection}[{index}].scheduled_date invalid"}
    return {"ok": True}


def normalize_standard_or_rich_post(post: Any, index: int) -> dict:
    if not isinstance(post, dict):
        return {"ok": False, "error": f"posts[{index}] invalid"}
    normalized = {
        "platform": normalize_platform(post.get("platform")),
        "post_type": normalize_post_type(post.get("post_type")),
        "caption": post["caption"].strip() if isinstance(post.get("caption"), str) else "",
        "hashtags": normalize_hashtags(post.get("hashtags")),
        "image_prompt": post["image_prompt"].strip()
        if isinstance(post.get("image_prompt"), str)
        else None,
        "video_idea": build_video_idea(post),
        "posting_tip": build_feed_posting_tip(post),
        "scheduled_date": post["scheduled_date"]
        if isinstance(post.get("scheduled_date"), str)
        else None,
        "image_path": post["image_path"].strip()
        if isinstance(post.get("image_path"), str) and post["image_path"].strip()
        else None,
    }
    validated = validate_normalized_post(normalized, index, "posts")
    if not validated["ok"]:
        return validated
    return {"ok": True, "post": normalized}


def normalize_story_post(story: Any, index: int) -> dict:
    if not isinstance(story, dict):
        return {"ok": False, "error": f"stories[{index}] invalid"}
    normalized = {
        "platform": "instagram",
        "post_type": "story",
        "caption": build_story_caption(story),
        "hashtags": [],
        "image_prompt": story["image_prompt"].strip()
        if isinstance(story.get("image_prompt"), str)
        else None,
        "video_idea": None,
        "posting_tip": build_story_posting_tip(story),
        "scheduled_date": story["scheduled_date"]
        if isinstance(story.get("scheduled_date"), str)
        else None,
        "image_path": None,
    }
    validated = validate_normalized_post(normalized, index, "stories")
    if not validated["ok"]:
        return validated
    return {"ok": True, "post": normalized}


def normalize_queue_payload(data: Any) -> dict:
    if not isinstance(data, dict):
        return {"ok": False, "error": "Root must be an object"}
    if not isinstance(data.get("account"), str) or not data["account"].strip():
        return {"ok": False, "error": "Missing or invalid account"}
    if not isinstance(data.get("generated_at"), str):
        return {"ok": False, "error": "Missing generated_at"}

    if isinstance(data.get("posts"), list):
        posts = []
        for i, p in enumerate(data["posts"]):
            normalized = normalize_standard_or_rich_post(p, i)
            if not normalized["ok"]:
                return normalized
            posts.append(normalized["post"])
        return {
            "ok": True,
            "kind": "posts",
            "data": {
                "account": data["account"].strip(),
                "generated_at": data["generated_at"],
                "posts": posts,
            },
        }

    if isinstance(data.get("stories"), list):
        posts = []
        for i, s in enumerate(data["stories"]):
            normalized = normalize_story_post(s, i)
            if not normalized["ok"]:
                return normalized
            posts.append(normalized["post"])
        return {
            "ok": True,
            "kind": "stories",
            "data": {
                "account": data["account"].strip(),
                "generated_at": data["generated_at"],
                "posts": posts,
            },
        }

    if isinstance(data.get("assets"), list):
        return {
            "ok": True,
            "kind": "manifest",
            "data": {
                "account": data["account"].strip(),
                "generated_at": data["generated_at"],
                "posts": [],
            },
            "assetCount": len(data["assets"]),
        }

    return {"ok": False, "error": "posts must be an array"}


def unique_platforms(posts: list[dict]) -> list[str]:
    seen = []
    for p in posts:
        plat = p.get("platform")
        if plat and plat not in seen:
            seen.append(plat)
    return seen


def is_tracked_sample(basename: str) -> bool:
    """Committed demo files (sample_*.json) stay in content-queue after import."""
    return basename.startswith("sample_") and basename.endswith(".json")


def find_or_create_account(db, persona_id: int, account_name: str, posts: list[dict]) -> int:
    name = account_name.strip()
    existing = db.execute(
        "SELECT id FROM accounts WHERE persona_id = ? AND name = ?",
        (persona_id, name),
    ).fetchone()
    if existing:
        return existing["id"]
    platforms = json.dumps(unique_platforms(posts))
    cur = db.execute(
        """INSERT INTO accounts (persona_id, name, product, type, platforms, tone, frequency, notes)
           VALUES (?, ?, ?, 'product', ?, NULL, 'weekly', NULL)""",
        (persona_id, name, f"Imported: {name}", platforms),
    )
    print(f"[parser] Created account {name} (persona {persona_id}, id {cur.lastrowid})")
    return int(cur.lastrowid)


def archive_filename(original_basename: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    return f"{ts}_{original_basename}"


def parse_file(abs_path: str | Path, persona_id_override: Optional[int] = None) -> dict:
    db = get_db()
    persona_id = persona_id_override if persona_id_override is not None else get_import_persona_id(db)
    paths = get_paths()
    basename = os.path.basename(str(abs_path))
    if not basename.endswith(".json"):
        return {"ok": False, "file": basename, "error": "Not a JSON file"}

    try:
        raw = Path(abs_path).read_text(encoding="utf-8")
    except Exception as e:
        return {"ok": False, "file": basename, "error": str(e)}

    try:
        data_json = json.loads(raw)
    except Exception as e:
        return {"ok": False, "file": basename, "error": f"Invalid JSON: {e}"}

    validated = normalize_queue_payload(data_json)
    if not validated["ok"]:
        print(f"[parser] {basename}: {validated['error']}")
        return {"ok": False, "file": basename, "error": validated["error"]}

    data = validated["data"]
    dest = Path(paths["content_archive"]) / archive_filename(basename)
    keep_sample = is_tracked_sample(basename)

    try:
        if validated["kind"] == "manifest":
            if keep_sample:
                shutil.copy2(abs_path, dest)
            else:
                Path(abs_path).rename(dest)
            asset_count = validated.get("assetCount") or 0
            print(
                f"[parser] Archived manifest {basename} → {dest.name} ({asset_count} assets)"
            )
            db.commit()
            return {
                "ok": True,
                "file": basename,
                "archived": dest.name,
                "count": 0,
                "kind": "manifest",
                "assets": asset_count,
            }

        if keep_sample:
            already = db.execute(
                """SELECT COUNT(*) AS c FROM posts p
                   JOIN accounts a ON a.id = p.account_id
                   WHERE a.persona_id = ? AND p.source_file = ?""",
                (persona_id, basename),
            ).fetchone()
            if already and int(already["c"] or 0) > 0:
                print(f"[parser] Skipping {basename}: already imported for this persona")
                return {
                    "ok": True,
                    "file": basename,
                    "count": 0,
                    "skipped": "already_imported",
                    "kind": validated["kind"],
                }

        account_id = find_or_create_account(db, persona_id, data["account"], data["posts"])
        for p in data["posts"]:
            db.execute(
                """INSERT INTO posts (
                     account_id, platform, post_type, caption, hashtags, image_prompt, image_path,
                     video_idea, posting_tip, status, scheduled_date, source_file
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)""",
                (
                    account_id,
                    p["platform"],
                    p["post_type"],
                    p["caption"],
                    json.dumps(p["hashtags"]),
                    p.get("image_prompt"),
                    p.get("image_path"),
                    p.get("video_idea"),
                    p.get("posting_tip"),
                    p.get("scheduled_date"),
                    basename,
                ),
            )
        if keep_sample:
            shutil.copy2(abs_path, dest)
        else:
            Path(abs_path).rename(dest)
        db.commit()
        print(f"[parser] Imported {basename} → {dest.name} ({len(data['posts'])} posts)")
        return {
            "ok": True,
            "file": basename,
            "archived": dest.name,
            "count": len(data["posts"]),
            "kind": validated["kind"],
        }
    except Exception as e:
        db.rollback()
        print(f"[parser] {basename}: DB error", e)
        return {"ok": False, "file": basename, "error": str(e)}


def parse_queue_dir(persona_id_override: Optional[int] = None) -> dict:
    paths = get_paths()
    queue = Path(paths["content_queue"])
    files = sorted(queue.glob("*.json"))
    results = [parse_file(f, persona_id_override) for f in files]
    return {"processed": len(results), "results": results}


class _QueueHandler(FileSystemEventHandler):
    def __init__(self, on_parsed: Optional[Callable[[dict], None]] = None):
        super().__init__()
        self.on_parsed = on_parsed

    def on_created(self, event):
        if event.is_directory:
            return
        path = event.src_path
        if not str(path).endswith(".json"):
            return
        self._schedule(path)

    def on_modified(self, event):
        if event.is_directory:
            return
        path = event.src_path
        if not str(path).endswith(".json"):
            return
        self._schedule(path)

    def _schedule(self, path: str) -> None:
        with _pending_lock:
            existing = _pending.pop(path, None)
            if existing:
                existing.cancel()

            def run():
                with _pending_lock:
                    _pending.pop(path, None)
                if not os.path.exists(path):
                    return
                # Wait until size stable
                try:
                    size1 = os.path.getsize(path)
                    time.sleep(STABILITY_MS / 1000)
                    if not os.path.exists(path):
                        return
                    size2 = os.path.getsize(path)
                    if size1 != size2:
                        self._schedule(path)
                        return
                except OSError:
                    return
                res = parse_file(path)
                if self.on_parsed:
                    self.on_parsed(res)

            timer = threading.Timer(STABILITY_MS / 1000, run)
            timer.daemon = True
            _pending[path] = timer
            timer.start()


def start_queue_watcher(on_parsed: Optional[Callable[[dict], None]] = None) -> Observer:
    global _watcher
    paths = get_paths()
    queue = Path(paths["content_queue"])
    queue.mkdir(parents=True, exist_ok=True)

    if _watcher is not None:
        return _watcher

    handler = _QueueHandler(on_parsed)
    observer = Observer()
    observer.schedule(handler, str(queue), recursive=False)
    observer.daemon = True
    observer.start()
    _watcher = observer
    print(f"[parser] Watching {queue}")
    return observer


def stop_queue_watcher() -> None:
    global _watcher
    if _watcher is not None:
        _watcher.stop()
        _watcher.join(timeout=2)
        _watcher = None
