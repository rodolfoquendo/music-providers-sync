# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

> The canonical agent-readable version of these instructions is **`AGENTS.md`** (same directory). Both files are kept in sync; CLAUDE.md adds Claude Code–specific detail where needed.

---

## Project Overview

`music-providers-sync` is a standalone music management tool that:
- Syncs playlists and liked songs **from Spotify** into a local MySQL database
- Pushes those playlists **to YouTube Music**
- Scans a **local music folder** and merges file metadata into the same DB
- Serves a **React web UI** with a multi-source player (local, Spotify SDK, YouTube iframe)

The MySQL database (`music`) lives on the shared `ie-api-db` container (MySQL 8, host port 3306). This is the same container used by `insignia-education/api`, but a completely separate database — never touch the `insignia` DB from this repo.

---

## Development Environment

```bash
cp .env.example .env   # fill in credentials
make up                # build and start containers
```

- API: `http://localhost:8002` (FastAPI auto-reload in dev mode)
- Frontend: `http://localhost:3002`

Shell into the API container:
```bash
make shell-api
```

Run locally without Docker (useful for fast iteration):
```bash
make dev-api    # uvicorn on :8002
make dev-front  # Vite dev server on :5173 (proxies /api → :8002)
```

---

## Stack and Patterns

| Layer | Tech |
|---|---|
| Backend | Python 3.12 + FastAPI + SQLAlchemy 2 + Pydantic v2 |
| Spotify | `spotipy` with OAuth Authorization Code flow |
| YouTube Music | `ytmusicapi` (unofficial — browser header auth) |
| Local metadata | `mutagen` |
| Frontend | React 19 + Vite 8 + Bootstrap 5.3 + React Router v7 |
| Player | Spotify Web Playback SDK + YouTube iframe API + HTML5 `<audio>` |
| DB | MySQL 8 (`music` DB on `host.docker.internal:3306`) |

### Backend conventions
- **Routers** (`app/routers/`) — HTTP layer only. No business logic here.
- **Services** (`app/services/`) — All Spotify/YouTube/local I/O. Routers call services.
- **Models** (`app/models/`) — SQLAlchemy ORM models, one file per table.
- **Schemas** (`app/schemas/`) — Pydantic v2 input/output schemas.
- Config is always read through `config.py` (`get_settings()`), never directly from `os.environ`.
- DB sessions injected via `Depends(get_db)`.

### Background tasks
Long-running syncs (`_run_spotify_import`, `_run_youtube_export`) use `BackgroundTasks` and create their own `SessionLocal()` — they cannot use the request-scoped session.

### Frontend conventions
- All API calls go through `src/api/client.js` (`api.*` methods) — never raw `fetch` in components.
- Player state lives in `PlayerContext`. Auth/connection state lives in `AuthContext`.
- No prop drilling — use contexts.

---

## Auth Notes

**Spotify OAuth** token is cached at `/tmp/.spotify_token_cache` inside the container. It auto-refreshes via `spotipy`. If the cache is missing, redirect to `GET /auth/spotify/login`.

**YouTube Music** auth is one-time browser header capture stored in `api/ytmusic_auth.json`. This file is gitignored. Re-run `make ytmusic-setup` if it expires (~30 days).

**Spotify Web Playback SDK** requires a Spotify Premium account. If the user is on Free tier, the player falls through to YouTube or preview URL.

---

## Working Style

- **Think before coding.** State assumptions. Ask if ambiguous.
- **Surgical changes.** Touch only what the task requires.
- **No speculative abstractions.** The minimum code that solves the problem.
- **Never commit `api/ytmusic_auth.json` or `.env`** — both are gitignored and contain live credentials.

## Git

- **NEVER commit in the agent's or Claude's name.** All commits must be authored solely by the human developer. Do not add `Co-Authored-By` trailers that name Claude or any AI agent.


## Communication style
- Respond as briefly as possible. Caveman mode: shortest answer that works. No fluff, no summaries, no "here is what I did".

---

## Git safety (CRITICAL — read every session)

**DO NOT MESS WITH GIT.** DO NOT run `git checkout`, `git stash`, `git reset`, `git restore`,
`git clean`, or any command that discards or overwrites working-tree changes. These repos often
carry large amounts of **uncommitted** work, and these commands will destroy it irreversibly.

If you need to change the current branch: **commit the work first, or ask the user to commit.**
Never revert, discard, or overwrite changes via git without explicit permission from the user.

## NEVER TOUCH `insignia-education/infra/envs`

**Read-only. Never create, edit, move, or delete anything under
`insignia-education/infra/envs/` — not one line, for any reason.**

That directory is the owner's personal record of the deployed environments,
kept manually on their machine. It is gitignored, so there is no history and
**nothing there can be recovered from git.** A prod env file was already lost
once this way.

- Need to know what a deployed env contains? Read it, don't write it.
- An env var needs to change? Say so and let the owner make the edit.
- Recovering a lost env: the deploy pipeline stores the authoritative copy in
  AWS SSM Parameter Store (e.g. `/ie/api/env-prod`), and the EC2 host holds a
  `chmod 600` copy at the deploy's `ENV_FILE_PATH`. Restore from SSM, and hand
  the file to the owner rather than writing into `envs/` yourself.
