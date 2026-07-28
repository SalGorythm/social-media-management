from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.config import get_settings
from api.db import get_db, set_import_target_persona_id
from api.deps import CurrentUser, PersonaId
from api.parser import parse_queue_dir, start_queue_watcher, stop_queue_watcher
from api.routes import accounts, auth, personas, posts, stats


def _error_payload(detail: Any) -> dict:
    if isinstance(detail, str):
        return {"error": detail}
    if isinstance(detail, list):
        # validation errors
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings["cors_origins"],
    allow_credentials=True,
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
