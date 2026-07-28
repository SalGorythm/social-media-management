# Social Content Studio

Local tool for managing social media content: drop structured JSON into a queue folder, FastAPI imports it into SQLite, and a React UI helps you review, edit, approve, and mark posts as posted.

**Primary entrypoint:** `python run.py` (starts FastAPI + Vite together, ports from `.env`).

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm** (Vite frontend only)

## Quick start

From the repository root:

```bash
# 1. Python env + deps
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. Frontend deps
npm install --prefix frontend

# 3. Config
cp .env.example .env               # set a real JWT_SECRET for anything beyond casual local use

# 4. Run API + UI
python run.py
```

Then open:

| Service | URL |
|---------|-----|
| Web UI | [http://127.0.0.1:5173](http://127.0.0.1:5173) |
| API health | [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) |
| API docs (optional) | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |

On first visit, **sign up**. Personas, accounts, and posts live in SQLite (`data/studio.db`) and are scoped to your user.

Stop with **Ctrl+C** — `run.py` shuts down both processes.

### Day-to-day

```bash
source .venv/bin/activate
python run.py
```

Do **not** use `npm run dev` for normal work. That path targets the legacy Node Express stack (or only prints a reminder). Prefer `python run.py`.

## Configuration (`.env`)

Copy [`.env.example`](.env.example) → `.env`. `run.py` loads it and sets `VITE_BACKEND_URL` from `BACKEND_*` so the Vite `/api` proxy always matches the API port.

| Variable | Default | Purpose |
|----------|---------|---------|
| `JWT_SECRET` | weak dev default if unset | Signs login JWTs |
| `BACKEND_HOST` | `127.0.0.1` | FastAPI bind host |
| `BACKEND_PORT` | `8000` | FastAPI bind port |
| `FRONTEND_HOST` | `127.0.0.1` | Vite bind host |
| `FRONTEND_PORT` | `5173` | Vite bind port (`strictPort: true` — will not silently hop) |
| `DB_PATH` | `data/studio.db` | SQLite file (relative to repo root) |
| `CORS_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Allowed browser origins |

Example:

```env
JWT_SECRET=change-me-to-a-long-random-string
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
FRONTEND_HOST=127.0.0.1
FRONTEND_PORT=5173
DB_PATH=data/studio.db
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

## Run processes separately (optional)

With the venv activated:

```bash
# API + queue watcher only
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000

# Frontend only (proxy must point at the API)
cd frontend
VITE_BACKEND_URL=http://127.0.0.1:8000 FRONTEND_PORT=5173 npm run dev
```

Frontend production build:

```bash
npm run build --prefix frontend
```

## Folder layout

| Path | Purpose |
|------|---------|
| `run.py` | Starts FastAPI + Vite with coordinated ports |
| `api/` | FastAPI app, auth, routes, parser, watchdog |
| `frontend/` | Vite + React + Tailwind UI |
| `content-queue/` | Drop generated `.json` files here |
| `content-archive/` | Successfully imported files (timestamp prefix) |
| `data/studio.db` | SQLite DB (created / reused automatically) |
| `requirements.txt` | Python dependencies |
| `.env` / `.env.example` | Local config |
| `backend/` | Legacy Node Express API — unused; prefer `api/` + `run.py` |
| `examples/` | Sample queue JSON |

## Auth and multi-tenant data

- **Sign up / Sign in** — JWT in `Authorization: Bearer` (browser `localStorage`).  
  `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`
- **Ownership** — Each persona has a `user_id`. Accounts and posts hang off personas, so users only see their own content. The first signup claims any legacy personas that had `user_id IS NULL`.
- **Queue → SQLite** — Parsed JSON is inserted into `posts` (accounts created if needed). Review queue, dashboard pipeline stats, calendar, and **Scan queue folder** all go through the API for the logged-in user’s active persona. The file watcher uses the last **import target** persona (updated on login / persona switch / parse).

## Personas (multi-app workspaces)

Each **persona** is a product/app workspace under your account. The sidebar switcher (or **Personas** page) sets the active persona for the UI and for `POST /api/parse`.

- Optional header: `X-Persona-Id: <id>` (must belong to you); otherwise the server uses your per-user active persona in `app_settings`.
- Personas API: `GET/POST /api/personas`, `GET/PUT/DELETE /api/personas/:id`, `GET/POST /api/personas/active`, `POST /api/personas/:id/context`

## Cursor workflow (generate → parse → review → post)

1. **Generate** — Ask Cursor for content matching the JSON schema below; save under `content-queue/`. Or use **Generate prompt** on the Accounts page.
2. **Parse** — Watchdog imports new `.json` files into SQLite and moves them to `content-archive/`. Files already in the queue when the server started are **not** auto-imported — use **Scan queue folder** on the Dashboard (`POST /api/parse`). Restore a demo from [`examples/sample-content-queue.json`](examples/sample-content-queue.json).
3. **Review** — **Review queue**: filter, approve, reject, edit, copy captions / image prompts.
4. **Post** — After publishing manually on each network, mark **posted**. Posted items leave the review queue / calendar / pipeline stats and appear under **Posted**.

## JSON schema (queue file)

**Filename:** `YYYY-MM-DD_accountname_platform.json` (any `.json` name works).

**Root:**

| Field | Type | Required |
|-------|------|----------|
| `account` | string (e.g. `@easysalahapp`) | yes |
| `generated_at` | ISO timestamp string | yes |
| `posts` | array of post objects | yes |

**Each post:**

| Field | Type | Notes |
|-------|------|--------|
| `platform` | string | `instagram` \| `x` \| `threads` \| `facebook` \| `reddit` |
| `post_type` | string | `post` \| `story` \| `reel` \| `carousel` |
| `caption` | string | Full caption |
| `hashtags` | string[] | Stored as JSON in SQLite |
| `image_prompt` | string or null | For image generators |
| `video_idea` | string or null | Reels / stories |
| `posting_tip` | string or null | Optional |
| `scheduled_date` | string or null | `YYYY-MM-DD` |

Example: [`examples/sample-content-queue.json`](examples/sample-content-queue.json).

## Auto-created accounts

If a queue file’s `account` does not exist for the import persona, the importer creates one with `product: Imported: {account}`, platforms from that file, `type: product`, `frequency: weekly`. Prefer defining accounts in the **Accounts** UI (demo accounts seed once per empty persona after signup).

## REST API (summary)

Except **`GET /api/health`**, **`POST /api/auth/signup`**, and **`POST /api/auth/login`**, routes need `Authorization: Bearer <jwt>`.

- **Auth:** `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`
- **Personas:** `GET/POST /api/personas`, `GET/PUT/DELETE /api/personas/:id`, `GET/POST /api/personas/active`, `POST /api/personas/:id/context`
- **Accounts:** `GET/POST /api/accounts`, `PUT/DELETE /api/accounts/:id`
- **Posts:** `GET /api/posts` (`status`, `exclude_status`, `account_id`, `platform`, `post_type`, `date_from`, `date_to`), `GET/PUT/DELETE /api/posts/:id`, `POST /api/posts/:id/approve|posted|reject`
- **Stats:** `GET /api/stats`, `GET /api/stats/activity`
- **Parse:** `POST /api/parse`

Interactive docs while the API is running: [/docs](http://127.0.0.1:8000/docs).

## Troubleshooting

**Login / signup fails or “network error”**

1. Confirm you started with `python run.py` (not a stale `npm run dev` on port 3001).
2. Open [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) — should return `{"ok":true}`.
3. Use the UI on the **exact** `FRONTEND_PORT` from `.env` (default `5173`). Vite uses `strictPort` and will not hop to another port.
4. Free stuck ports if needed:

```bash
# macOS / Linux examples
lsof -i :8000 -i :5173
# kill leftover Node Express if still bound to 3001
lsof -i :3001
```

**Port already in use**

Change `BACKEND_PORT` / `FRONTEND_PORT` in `.env`, then restart `python run.py`. CORS origins should still list your UI origin.

**Existing DB / users**

`DB_PATH` reuses `data/studio.db`. Existing bcrypt password hashes from the old Node app should still verify. If auth is broken after a secret change, clear the browser token (log out) or sign up a new local user.

## License

Private / personal project — adjust as needed.
