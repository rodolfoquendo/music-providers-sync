# music-providers-sync

A standalone music management tool that syncs playlists and liked songs from Spotify into a local MySQL database, pushes them to YouTube Music, and serves a React web UI with a multi-source player.

## Features

- Sync playlists and liked songs from **Spotify** into a local MySQL database
- Push playlists to **YouTube Music**
- Scan a **local music folder** and merge file metadata into the same DB
- **React web UI** with a multi-source player (local files, Spotify Web Playback SDK, YouTube iframe)

## Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12 + FastAPI + SQLAlchemy 2 + Pydantic v2 |
| Spotify | `spotipy` with OAuth Authorization Code flow |
| YouTube Music | `ytmusicapi` (unofficial — browser header auth) |
| Local metadata | `mutagen` |
| Frontend | React 19 + Vite 8 + Bootstrap 5.3 + React Router v7 |
| Player | Spotify Web Playback SDK + YouTube iframe API + HTML5 `<audio>` |
| DB | MySQL 8 (`music` DB on `host.docker.internal:3306`) |

## Getting Started

```bash
cp .env.example .env   # fill in credentials
make up                # build and start containers
```

- API: [http://localhost:8002](http://localhost:8002)
- Frontend: [http://localhost:3002](http://localhost:3002)

### Running without Docker

```bash
make dev-api    # uvicorn on :8002
make dev-front  # Vite dev server on :5173 (proxies /api → :8002)
```

### Shell into the API container

```bash
make shell-api
```

## Auth

### Spotify

OAuth token is cached at `/tmp/.spotify_token_cache` inside the container and auto-refreshes via `spotipy`. If the cache is missing, redirect to `GET /auth/spotify/login`.

> Requires a **Spotify Premium** account for the Web Playback SDK. Free-tier users fall through to YouTube or preview URLs.

### YouTube Music

One-time browser header capture stored in `api/ytmusic_auth.json` (gitignored). Re-run the setup if it expires (~30 days):

```bash
make ytmusic-setup
```

## Project Structure

```
api/
  app/
    routers/    # HTTP layer — no business logic
    services/   # Spotify / YouTube / local I/O
    models/     # SQLAlchemy ORM models (one file per table)
    schemas/    # Pydantic v2 input/output schemas
    config.py   # All config via get_settings(), never os.environ directly
front/
  src/
    api/client.js   # All API calls go here — never raw fetch in components
    contexts/       # PlayerContext, AuthContext
```

Long-running syncs use FastAPI `BackgroundTasks` with their own `SessionLocal()` — they do not share the request-scoped session.
