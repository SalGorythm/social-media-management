## Summary

<!-- What does this PR change and why? -->

## Test plan

- [ ] `python setup.py` (or existing venv) still works
- [ ] `python run.py` — sign up / log in, load dashboard
- [ ] If API routes changed: hit `/api/health` and the affected endpoints
- [ ] If Docker changed: `docker compose up --build` and open the UI

## Safety (required for this public repo)

- [ ] No `.env`, database files, passwords, or API keys
- [ ] No personal / client content in `content-queue/`, `content-archive/`, or `products_contexts/`
- [ ] No real account emails or private product briefs in the diff
