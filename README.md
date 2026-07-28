# Social Content Studio

Local (or Docker) tool for managing social media content: drop structured JSON into a queue folder, FastAPI imports it into SQLite, and a React UI helps you review, edit, approve, and mark posts as posted.

**Primary local entrypoint:** `python setup.py` once, then `python run.py`.

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm** (for local Vite / frontend install)
- Optional: **Docker** + Docker Compose

## Quick start (local)

```bash
python3 setup.py          # venv, pip, npm, .env, folders
source .venv/bin/activate # Windows: .venv\Scripts\activate
# edit .env — set JWT_SECRET
python run.py
```

Then open:

| Service | URL |
|---------|-----|
| Web UI (dev) | [http://127.0.0.1:5173](http://127.0.0.1:5173) |
| API health | [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) |
| API docs | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |

Sign up on first visit. Data is stored in SQLite under `data/` (local only; not committed).

Stop with **Ctrl+C**.

### What `setup.py` does

1. Checks Python 3.10+ and `npm`
2. Creates `.venv` and installs [`requirements.txt`](requirements.txt)
3. Runs `npm install` in `frontend/`
4. Copies `.env.example` → `.env` if missing (does not overwrite)
5. Ensures `data/`, `content-queue/`, `content-archive/`, `products_contexts/` exist

### Day-to-day

```bash
source .venv/bin/activate
python run.py
```

Prefer `python run.py` over `npm run dev` (the latter is legacy Node tooling).

## Docker

Single image: FastAPI serves **API + built UI** on port **8000**.

```bash
cp .env.example .env   # set JWT_SECRET
mkdir -p data content-queue content-archive products_contexts
docker compose up --build
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

Volumes persist SQLite and queue folders on the host. Equivalent manual run:

```bash
docker build -t social-content-studio .
docker run --env-file .env -p 8000:8000 \
  -v "$PWD/data:/app/data" \
  -v "$PWD/content-queue:/app/content-queue" \
  -v "$PWD/content-archive:/app/content-archive" \
  -v "$PWD/products_contexts:/app/products_contexts" \
  social-content-studio
```

Optional nginx in front:

```bash
docker compose --profile edge up --build
# edge listens on FRONTEND_PORT (default 8080) → proxies to the app
```

## Configuration (`.env`)

See [`.env.example`](.env.example). `run.py` sets `VITE_BACKEND_URL` from `BACKEND_*` so the Vite `/api` proxy matches the API.

| Variable | Default | Purpose |
|----------|---------|---------|
| `JWT_SECRET` | weak dev default if unset | Signs login JWTs |
| `BACKEND_HOST` / `BACKEND_PORT` | `127.0.0.1` / `8000` | FastAPI bind |
| `FRONTEND_HOST` / `FRONTEND_PORT` | `127.0.0.1` / `5173` | Vite bind (`strictPort`) |
| `DB_PATH` | `data/studio.db` | SQLite path |
| `CORS_ORIGINS` | localhost:5173 | Comma-separated origins (`*` allowed in Docker) |
| `STATIC_DIR` | `frontend/dist` | Built UI (Docker / production) |

## Local-only paths (do not commit)

These are **gitignored** except empty `.gitkeep` placeholders:

| Path | Purpose |
|------|---------|
| `data/` | SQLite DB (users, posts) |
| `content-queue/` | JSON files you drop for import |
| `content-archive/` | Successfully imported files |
| `products_contexts/` | Your private product briefs (optional) |
| `.env` | Secrets |

Generic demo JSON: [`examples/sample-content-queue.json`](examples/sample-content-queue.json) — copy into `content-queue/` then use **Scan queue folder**.

## Folder layout

| Path | Purpose |
|------|---------|
| `setup.py` | First-time bootstrap |
| `run.py` | Starts FastAPI + Vite with coordinated ports |
| `api/` | FastAPI app, auth, routes, parser, watcher |
| `frontend/` | Vite + React + Tailwind UI |
| `Dockerfile` / `docker-compose.yml` | Container deploy |
| `examples/` | Sample queue JSON (safe to commit) |
| `backend/` | Legacy Node Express API (unused) |

## AI generation

Two paths (same JSON → `content-queue` → import):

1. **Cursor / Claude / Copilot (IDE)** — Accounts → **Cursor prompt** → copy into your editor → save JSON under `content-queue/` → Scan.
2. **In-app LLM** — [AI settings](http://127.0.0.1:5173/settings/ai): add **Gemini**, **OpenAI**, or **xAI Grok** keys (stored per user, encrypted). Then Accounts → **Generate with AI**.

See the in-app **Guide** page for the full walkthrough.

## Auth and multi-tenant data

- **Sign up / Sign in** — JWT Bearer token in the browser.  
  `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`
- **Ownership** — Personas belong to a user; accounts and posts hang off personas.
- **Queue → SQLite** — Watchdog imports new `.json` files; Dashboard **Scan queue folder** processes files already in the queue.

## Personas

Each persona is a product/app workspace. Switch via the sidebar or **Personas** page. Optional header `X-Persona-Id` must belong to you.

## Cursor workflow

1. **Generate** JSON matching the schema below → save under `content-queue/`.
2. **Parse** — auto on new files, or **Scan queue folder**.
3. **Review** — approve / reject / edit.
4. **Post** — mark **posted** after you publish manually; archive under **Posted**.

## JSON schema (queue file)

**Root:** `account` (string), `generated_at` (ISO string), `posts` (array).

**Each post:** `platform` (`instagram` \| `x` \| `threads` \| `facebook` \| `reddit`), `post_type` (`post` \| `story` \| `reel` \| `carousel`), `caption`, `hashtags` (string[]), optional `image_prompt`, `video_idea`, `posting_tip`, `scheduled_date` (`YYYY-MM-DD`).

Example: [`examples/sample-content-queue.json`](examples/sample-content-queue.json).

## REST API (summary)

Auth required except health + signup/login. Interactive docs: `/docs`.

- Auth, personas, accounts, posts (`approve` / `posted` / `reject`), stats, `POST /api/parse`

## Contributing

PRs only — maintainers approve before merge. See [CONTRIBUTING.md](CONTRIBUTING.md).

**Repo owners:** protect `main` on GitHub (require PR + 1 approving review) and set your handle in [`.github/CODEOWNERS`](.github/CODEOWNERS).

## Troubleshooting

**Login / network errors**

1. Use `python run.py` (or Docker on `:8000`), not a stale Node process on `:3001`.
2. Check [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health).
3. Dev UI must use `FRONTEND_PORT` from `.env` (default `5173`; `strictPort` — no silent hop).

**Ports in use**

```bash
lsof -i :8000 -i :5173 -i :3001
```

Change ports in `.env` and restart.

## License

Private / personal project unless you add an open-source license — adjust as needed before going public.
