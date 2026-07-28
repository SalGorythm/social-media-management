from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from api.config import get_settings
from api.db import get_db, set_import_target_persona_id
from api.deps import CurrentUser, PersonaId
from api.parser import parse_queue_dir, start_queue_watcher, stop_queue_watcher
from api.routes import accounts, auth, personas, posts, stats


def _error_payload(detail: Any) -> dict:
    if isinstance(detail, str):
        return {"error": detail}
    if isinstance(detail, list):
        msgs = []
        for item in detail:
            if isinstance(item, dict) and "msg" in item:
                msgs.append(str(item["msg"]))
            else:
                msgs.append(str(item))
        return {"error": "; ".join(msgs) if msgs else "Validation error"}
    return {"error": str(detail)}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_db()
    start_queue_watcher(
        lambda result: print("[watch] parse result:", result)
        if not result.get("ok")
        else None
    )
    yield
    stop_queue_watcher()


app = FastAPI(title="Social Content Studio", lifespan=lifespan)

settings = get_settings()
_cors = settings["cors_origins"]
_allow_all = _cors == ["*"] or (len(_cors) == 1 and _cors[0] == "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else _cors,
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content=_error_payload(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content=_error_payload(exc.errors()))


app.include_router(auth.router)
app.include_router(personas.router)
app.include_router(accounts.router)
app.include_router(posts.router)
app.include_router(stats.router)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/parse")
def parse_queue(_user: CurrentUser, persona_id: PersonaId) -> dict:
    try:
        db = get_db()
        set_import_target_persona_id(db, persona_id)
        db.commit()
        return parse_queue_dir(persona_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _mount_spa_if_present() -> None:
    static_dir: Path = settings["static_dir"]
    index = static_dir / "index.html"
    if not index.is_file():
        return

    assets = static_dir / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    @app.get("/")
    def spa_root():
        return FileResponse(index)

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = static_dir / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index)

    print(f"[static] Serving SPA from {static_dir}")


_mount_spa_if_present()
