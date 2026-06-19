# music-providers-sync

Syncs music between Spotify and YouTube Music, scans local folders, stores full track metadata in MySQL, and serves a web UI with a multi-source player.

## Requirements
- Docker + Docker Compose
- A Spotify app registered at https://developer.spotify.com/dashboard
- (Optional) YouTube Music session headers for `ytmusicapi`

## Quick start
```bash
cp .env.example .env       # fill in SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, DB_PASSWORD
make up                    # build and start API (port 8002) + frontend (port 3002)
```

App runs at `http://localhost:3002`. API at `http://localhost:8002`.

## Stack
| Layer | Tech |
|---|---|
| Backend | Python 3.12 + FastAPI + SQLAlchemy 2 |
| Spotify | `spotipy` (OAuth Authorization Code) |
| YouTube Music | `ytmusicapi` (browser header auth — unofficial) |
| Local music | `mutagen` |
| Frontend | React 19 + Vite 8 + Bootstrap 5.3 |
| Player | Spotify Web Playback SDK + YouTube iframe API + HTML5 `<audio>` |
| Database | MySQL 8 (`music` DB on existing `ie-api-db` container, port 3306) |
| Containers | Own `docker-compose.yml` — API :8002, frontend :3002 |

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
make dev-api       # run API locally (no Docker)
make dev-front     # run Vite dev server locally
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
5. **Requires Spotify Premium** for the Web Playback SDK player

### YouTube Music
1. Run `make ytmusic-setup` (inside the API container)
2. Paste your browser headers from a logged-in YouTube Music session (see ytmusicapi docs)
3. Output is saved as `api/ytmusic_auth.json`
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
