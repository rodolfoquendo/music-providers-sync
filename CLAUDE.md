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
