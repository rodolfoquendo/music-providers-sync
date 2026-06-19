from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .database import engine, Base
from .models import Track, Playlist, PlaylistTrack, SyncLog  # register models
from .routers import auth, spotify, youtube, local, tracks, playlists, sync

app = FastAPI(title="Music Providers Sync", version="1.0.0")

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
