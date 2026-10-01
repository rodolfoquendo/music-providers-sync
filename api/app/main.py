from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from .config import get_settings
from .database import engine, Base
from .models import Track, Playlist, PlaylistTrack, SyncLog  # register models
from .services import video_worker, download_worker
from .routers import auth, spotify, youtube, local, tracks, playlists, sync

@asynccontextmanager
async def lifespan(_: FastAPI):
    video_worker.start()
    download_worker.start()
    yield
    video_worker.stop()
    download_worker.stop()


app = FastAPI(title="Music Providers Sync", version="1.0.0", lifespan=lifespan)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup (idempotent)
Base.metadata.create_all(bind=engine)

# create_all never alters existing tables — idempotent upgrades for columns/enums added later
with engine.begin() as conn:
    conn.execute(text(
        "ALTER TABLE sync_logs MODIFY direction "
        "ENUM('spotify_import','youtube_export','local_scan','youtube_download','youtube_video_search') NOT NULL"
    ))
    existing = {c["name"] for c in inspect(conn).get_columns("tracks")}
    if "youtube_video_id" not in existing:
        conn.execute(text("ALTER TABLE tracks ADD COLUMN youtube_video_id VARCHAR(100) NULL, ADD INDEX ix_tracks_youtube_video_id (youtube_video_id)"))
    for col, ddl in {
        "requested_download_at": "DATETIME NULL",
        "download_source": "VARCHAR(10) NULL",
        "downloaded_at": "DATETIME NULL",
        "download_error": "TEXT NULL",
    }.items():
        if col not in existing:
            conn.execute(text(f"ALTER TABLE tracks ADD COLUMN {col} {ddl}"))
    if "youtube_video_checked_at" not in existing:
        conn.execute(text("ALTER TABLE tracks ADD COLUMN youtube_video_checked_at DATETIME NULL"))
    if "youtube_video_url" not in existing:
        conn.execute(text("ALTER TABLE tracks ADD COLUMN youtube_video_url TEXT NULL"))
    # background syncs die with the process; free their "running" lock so they can be restarted
    conn.execute(text(
        "UPDATE sync_logs SET status='failed', error_message='Interrupted by API restart', finished_at=NOW() "
        "WHERE status='running'"
    ))

app.include_router(auth.router)
app.include_router(spotify.router)
app.include_router(youtube.router)
app.include_router(local.router)
app.include_router(tracks.router)
app.include_router(playlists.router)
app.include_router(sync.router)


@app.get("/health")
def health():
    return {"status": "ok"}
