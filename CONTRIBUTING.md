# Contributing

Thanks for helping improve Social Content Studio.

## How to contribute

1. **Fork** the repository and clone your fork.
2. Create a branch: `git checkout -b feature/your-change`.
3. Run first-time setup if needed: `python3 setup.py`.
4. Make changes. Do **not** commit personal data (see below).
5. Open a **Pull Request** against `main` on the upstream repo.
6. Wait for a **maintainer approval** before the change is merged.

Direct pushes to `main` are not accepted. All changes go through a PR.

## Maintainer: require approval on GitHub

Repo settings (GitHub → **Settings → Branches → Branch protection rules** for `main`):

- Require a pull request before merging
- Require at least **1 approving review**
- Dismiss stale pull request approvals when new commits are pushed
- Do not allow force pushes
- Do not allow deletions

Also edit [`.github/CODEOWNERS`](.github/CODEOWNERS) and replace `YOUR_GITHUB_USERNAME` with your GitHub handle so you are requested on every PR.

## What not to commit

These paths are for **local use only** (gitignored except `.gitkeep`):

- `.env` / secrets
- `data/*.db` (SQLite with users and posts)
- `content-queue/*` (your draft JSON)
- `content-archive/*` (imported history)
- `products_contexts/*` (product briefs)

Use [`examples/sample-content-queue.json`](examples/sample-content-queue.json) for generic demos only.

If you previously pushed personal files to a remote, scrubbing the working tree is not enough — rewrite history (e.g. `git filter-repo`) before making the repo public, or start from a clean orphan commit.

## License & commercial use

This project is **not** open-source MIT/Apache. See [`LICENSE`](LICENSE).

- Contributions are welcome for non-commercial community improvement.
- By opening a PR you agree your contribution may be included under the same proprietary community license.
- **Do not** use this software commercially (SaaS, paid agency tooling, resale, etc.) without written authorization from the owner ([@SalGorythm](https://github.com/SalGorythm)).

## Development tips

```bash
python3 setup.py
source .venv/bin/activate
python run.py
```

API docs while running: http://127.0.0.1:8000/docs

Docker:

```bash
docker compose up --build
# UI + API: http://127.0.0.1:8000
```
