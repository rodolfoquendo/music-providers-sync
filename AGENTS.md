# music-providers-sync

Syncs music between Spotify and YouTube Music, scans local folders, stores full track metadata in MySQL, and serves a web UI with a multi-source player.

`music-providers-sync` is a standalone music management tool that:
- Syncs playlists and liked songs **from Spotify** into a local MySQL database
- Pushes those playlists **to YouTube Music**
- Scans a **local music folder** and merges file metadata into the same DB
- Serves a **React web UI** with a multi-source player (local, Spotify SDK, YouTube iframe)

The MySQL database (`music`) lives on the shared `ie-api-db` container (MySQL 8, host port 3306). This is the same container used by `insignia-education/api`, but a completely separate database — **never touch the `insignia` DB from this repo.**

## Requirements
- Docker + Docker Compose
- A Spotify app registered at https://developer.spotify.com/dashboard
- (Optional) YouTube Music session headers for `ytmusicapi`

## Quick start
```bash
cp .env.example .env       # fill in SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, DB_PASSWORD
make up                    # build and start API (port 8002) + frontend (port 3002)
```

App runs at `http://localhost:3002`. API at `http://localhost:8002` (FastAPI auto-reload in dev mode).

## Stack
| Layer | Tech |
|---|---|
| Backend | Python 3.12 + FastAPI + SQLAlchemy 2 + Pydantic v2 |
| Spotify | `spotipy` (OAuth Authorization Code) |
| YouTube Music | `ytmusicapi` (browser header auth — unofficial) |
| Local music | `mutagen` |
| Frontend | React 19 + Vite 8 + Bootstrap 5.3 + React Router v7 |
| Player | Spotify Web Playback SDK + YouTube iframe API + HTML5 `<audio>` |
| Database | MySQL 8 (`music` DB on existing `ie-api-db` container, port 3306) |
| Containers | Own `docker-compose.yml` — API :8002, frontend :3002 |

### Backend conventions
- **Routers** (`app/routers/`) — HTTP layer only. No business logic here.
- **Services** (`app/services/`) — All Spotify/YouTube/local I/O. Routers call services.
- **Models** (`app/models/`) — SQLAlchemy ORM models, one file per table.
- **Schemas** (`app/schemas/`) — Pydantic v2 input/output schemas.
- Config is always read through `config.py` (`get_settings()`), never directly from `os.environ`.
- DB sessions injected via `Depends(get_db)`.
- Long-running syncs (`_run_spotify_import`, `_run_youtube_export`) use `BackgroundTasks` and create their own `SessionLocal()` — they cannot use the request-scoped session.

### Frontend conventions
- All API calls go through `src/api/client.js` (`api.*` methods) — never raw `fetch` in components.
- Player state lives in `PlayerContext`. Auth/connection state lives in `AuthContext`.
- No prop drilling — use contexts.

## Structure
```
music-providers-sync/
├── api/
│   ├── app/
│   │   ├── routers/       ← auth, spotify, youtube, local, tracks, playlists, sync
│   │   ├── services/      ← spotify_service, youtube_service, local_service
│   │   ├── models/        ← Track, Playlist, PlaylistTrack, SyncLog (SQLAlchemy)
│   │   ├── schemas/       ← Pydantic I/O schemas
│   │   ├── config.py      ← Pydantic Settings (reads .env)
│   │   ├── database.py    ← SQLAlchemy engine + session
│   │   └── main.py        ← FastAPI app, router registration, table creation
│   ├── requirements.txt
│   └── Dockerfile
├── front/
│   ├── src/
│   │   ├── api/client.js      ← fetch wrappers for all API endpoints
│   │   ├── contexts/          ← PlayerContext, AuthContext
│   │   ├── components/        ← GlobalPlayer, SyncPanel, TrackTable, PlaylistList
│   │   └── pages/             ← Home (tracks + sync), Playlists, Settings
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── Makefile
```

## Makefile
```bash
make up            # build + start
make down          # stop
make logs          # tail logs
make shell-api     # bash into music-api container
make scan-local    # POST /local/scan
make ytmusic-setup # one-time YouTube Music auth setup
make dev-api       # run API locally, uvicorn on :8002 (no Docker, fast iteration)
make dev-front     # run Vite dev server locally on :5173 (proxies /api → :8002)
```

## Database (music DB on ie-api-db)
Tables created automatically on first API startup via `Base.metadata.create_all`.

| Table | Purpose |
|---|---|
| `tracks` | Every song with all Spotify/YTM/local metadata |
| `playlists` | Playlists from any source |
| `playlist_tracks` | Track ↔ playlist membership + position |
| `sync_logs` | One row per sync run with stats and status |

## Auth setup

### Spotify
1. Register an app at https://developer.spotify.com/dashboard
2. Add redirect URI: `http://localhost:8002/auth/spotify/callback`
3. Set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in `.env`
4. Visit `http://localhost:8002/auth/spotify/login` → authorize → done
5. **Requires Spotify Premium** for the Web Playback SDK player. If the user is on the Free tier, the player falls through to YouTube or a preview URL.
6. The OAuth token is cached at `/tmp/.spotify_token_cache` inside the container and auto-refreshes via `spotipy`. If the cache is missing, redirect to `GET /auth/spotify/login`.

### YouTube Music
1. Run `make ytmusic-setup` (inside the API container)
2. Paste your browser headers from a logged-in YouTube Music session (see ytmusicapi docs)
3. Output is saved as `api/ytmusic_auth.json` (gitignored)
4. Restart the container — `youtube_service.py` reads this file on init
5. **Re-auth required** when the session expires (~30 days)

### Local music
Set `MUSIC_LOCAL_PATH` in `.env` to an absolute folder path. The container mounts it read-only.

## Sync flow

**Spotify → DB:**
`POST /sync/spotify` runs in the background:
- Fetches all liked songs + all playlists (or selected ones)
- Upserts into `tracks` + `playlists` + `playlist_tracks`
- For each new track, searches YouTube Music to fill `youtube_id`

**DB → YouTube Music:**
`POST /sync/youtube` runs in the background:
- For each sync-enabled playlist, creates/finds the YTM playlist by name
- Adds tracks (by `youtube_id`) to the YTM playlist

## Player priority
```
track.local_path   → HTML5 <audio> via GET /tracks/{id}/stream
track.spotify_uri  → Spotify Web Playback SDK (Premium required)
track.youtube_id   → YouTube iframe API
```

## Never do
- Don't add Spotify streaming outside the Web Playback SDK — against Spotify TOS
- Don't commit `api/ytmusic_auth.json` or `.env` — both are gitignored
- Don't write business logic in routers — put it in services
- Don't hardcode credentials — use `.env` via `config.py`
- Don't touch the `insignia` database on the shared `ie-api-db` container — see above

## Working style and communication
See [`.ai/guidelines/working-style.md`](.ai/guidelines/working-style.md) for coding style and communication conventions (think before coding, surgical changes, caveman-mode responses).

## Git
See [`.ai/guidelines/git-safety.md`](.ai/guidelines/git-safety.md) — critical rules on never running destructive git commands, and on commit authorship (never commit in an agent's name).

## Restricted paths
See [`.ai/docs/insignia-envs.md`](.ai/docs/insignia-envs.md) — `insignia-education/infra/envs/` is read-only, never edit it.

## Git workflow

- **Always confirm the branch first.** Before starting any task, check the current branch and ask the user which branch to use — don't assume, even when one looks obviously right. A stale branch, or another session's branch mid-task, can look plausible and still be wrong.
- **Branch per task, cut from `master` only.**
  ```
  git checkout master && git pull && git checkout -b task/<name>
  ```
- **Never commit directly to `master`.** All work happens on a task branch. (This repo has no `beta` branch — a personal project with no staging deploy; ignore any stale reference elsewhere in this file to one.)
- **Keep local `master` updated.** `git pull` it before cutting a new branch and before merging any PR into it.
- **Merging to `master` needs explicit permission.** Never merge a branch into `master` on your own judgment — open a PR (`gh pr create`) and ask the user before merging it. Merges to `master` go through GitHub, not a local `git merge`.
- **After a branch's PR merges, clean up.** Delete it locally and on GitHub, and switch back to `master` locally.
  ```
  git checkout master && git pull
  git branch -d task/<name>
  git push origin --delete task/<name>
  ```

## Before starting a task

See "Git workflow" above — check the current branch and ask the user which one to use before doing anything else.

## Communication style
- TL;DR always. Fewest words possible. No preamble, no step-by-step narration, no "here is what I did" summaries, no explaining what you are about to do.
- Log every command executed and every file write, verbatim — syscalls and writes, not model narration.
- Report outputs, not steps: state what a command produced/changed, not the fact that you ran it or why.
