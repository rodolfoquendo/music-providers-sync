from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db, SessionLocal
from ..models import Track, Playlist, PlaylistTrack, SyncLog
from ..schemas.sync import SyncRequest, SyncLogOut
from ..services import spotify_service, youtube_service

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/logs", response_model=list[SyncLogOut])
def list_logs(limit: int = 20, db: Session = Depends(get_db)):
    return db.query(SyncLog).order_by(SyncLog.started_at.desc()).limit(limit).all()


@router.post("/spotify")
def sync_from_spotify(body: SyncRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not spotify_service.is_connected():
        raise HTTPException(400, "Spotify not connected. Visit /auth/spotify/login first.")
    running = db.query(SyncLog).filter(SyncLog.direction == "spotify_import", SyncLog.status == "running").first()
    if running:
        raise HTTPException(409, f"A Spotify import is already running (log id={running.id}).")
    background_tasks.add_task(_run_spotify_import, body.playlist_ids)
    return {"message": "Spotify import started in background"}


@router.post("/youtube")
def sync_to_youtube(body: SyncRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not youtube_service.is_connected():
        raise HTTPException(400, "YouTube Music not connected. Set up ytmusic_auth.json.")
    running = db.query(SyncLog).filter(SyncLog.direction == "youtube_export", SyncLog.status == "running").first()
    if running:
        raise HTTPException(409, f"A YouTube export is already running (log id={running.id}).")
    background_tasks.add_task(_run_youtube_export, body.playlist_ids)
    return {"message": "YouTube Music export started in background"}


def _upsert_track(db: Session, data: dict) -> Track:
    track = None
    if data.get("spotify_id"):
        track = db.query(Track).filter(Track.spotify_id == data["spotify_id"]).first()
    if not track:
        track = Track()
        db.add(track)
    for k, v in data.items():
        if v is not None:
            setattr(track, k, v)
    db.flush()
    return track


def _upsert_playlist(db: Session, name: str, source: str, source_id: str, cover_url=None, description=None) -> Playlist:
    pl = db.query(Playlist).filter(
        Playlist.source == source, Playlist.source_id == source_id
    ).first()
    if not pl:
        pl = Playlist(name=name, source=source, source_id=source_id)
        db.add(pl)
    pl.name = name
    if cover_url:
        pl.cover_url = cover_url
    if description:
        pl.description = description
    db.flush()
    return pl


def _link_track_to_playlist(db: Session, playlist: Playlist, track: Track, position: int):
    exists = db.query(PlaylistTrack).filter(
        PlaylistTrack.playlist_id == playlist.id,
        PlaylistTrack.track_id == track.id,
    ).first()
    if not exists:
        db.add(PlaylistTrack(playlist_id=playlist.id, track_id=track.id, position=position))


def _run_spotify_import(playlist_ids: list[int] | None):
    db = SessionLocal()
    log = SyncLog(direction="spotify_import", status="running")
    db.add(log)
    db.commit()
    stats = {"found": 0, "added": 0, "updated": 0, "skipped": 0, "errors": []}
    try:
        # Import liked songs
        liked_items = spotify_service.get_liked_songs()
        liked_pl = _upsert_playlist(db, "Liked Songs", "spotify", "liked")
        for i, item in enumerate(liked_items):
            parsed = spotify_service.parse_track(item)
            if not parsed:
                stats["skipped"] += 1
                continue
            stats["found"] += 1
            is_new = not db.query(Track).filter(Track.spotify_id == parsed["spotify_id"]).first()
            track = _upsert_track(db, parsed)
            _link_track_to_playlist(db, liked_pl, track, i)
            stats["added" if is_new else "updated"] += 1

        liked_pl.last_synced_at = datetime.utcnow()
        db.commit()

        # Import user playlists
        all_playlists = spotify_service.get_playlists()
        db_playlists = db.query(Playlist).filter(Playlist.source == "spotify").all()
        db_pl_map = {pl.source_id: pl.id for pl in db_playlists}

        for sp_pl in all_playlists:
            pl_id = sp_pl["id"]
            # If specific playlist DB IDs were requested, filter by source_id
            if playlist_ids is not None:
                if pl_id not in [p.source_id for p in db_playlists if p.id in playlist_ids]:
                    continue

            try:
                images = sp_pl.get("images") or []
                cover = images[0]["url"] if images else None
                pl = _upsert_playlist(db, sp_pl["name"], "spotify", pl_id, cover, sp_pl.get("description"))

                sp_tracks = spotify_service.get_playlist_tracks(pl_id)
                for i, item in enumerate(sp_tracks):
                    parsed = spotify_service.parse_track(item)
                    if not parsed:
                        stats["skipped"] += 1
                        continue
                    stats["found"] += 1
                    is_new = not db.query(Track).filter(Track.spotify_id == parsed["spotify_id"]).first()
                    track = _upsert_track(db, parsed)
                    _link_track_to_playlist(db, pl, track, i)
                    stats["added" if is_new else "updated"] += 1

                pl.last_synced_at = datetime.utcnow()
                db.commit()
            except Exception as pl_err:
                db.rollback()
                stats["errors"].append(f"Playlist '{sp_pl.get('name', pl_id)}': {pl_err}")
                continue

        # Search YouTube IDs for tracks that don't have one
        tracks_without_yt = db.query(Track).filter(Track.youtube_id.is_(None), Track.spotify_id.isnot(None)).all()
        for track in tracks_without_yt:
            yt_id = youtube_service.search_track(track.title, track.artist)
            if yt_id:
                track.youtube_id = yt_id
                track.youtube_url = f"https://music.youtube.com/watch?v={yt_id}"
        db.commit()

        log.status = "success"
    except Exception as e:
        db.rollback()
        log.status = "failed"
        log.error_message = str(e)
        stats["errors"].append(str(e))
    finally:
        log.stats = stats
        log.finished_at = datetime.utcnow()
        db.commit()
        db.close()


def _run_youtube_export(playlist_ids: list[int] | None):
    db = SessionLocal()
    log = SyncLog(direction="youtube_export", status="running")
    db.add(log)
    db.commit()
    stats = {"found": 0, "added": 0, "skipped": 0, "errors": []}
    try:
        query = db.query(Playlist).filter(Playlist.sync_enabled == True)
        if playlist_ids:
            query = query.filter(Playlist.id.in_(playlist_ids))
        playlists = query.all()

        for pl in playlists:
            yt_pl_id = youtube_service.create_or_get_playlist(pl.name, pl.description or "")
            if not yt_pl_id:
                stats["errors"].append(f"Could not create YTM playlist: {pl.name}")
                continue

            pt_rows = db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == pl.id).all()
            video_ids = []
            for pt in pt_rows:
                track = db.query(Track).filter(Track.id == pt.track_id).first()
                if track and track.youtube_id:
                    video_ids.append(track.youtube_id)
                    stats["found"] += 1
                else:
                    stats["skipped"] += 1

            if video_ids:
                youtube_service.add_to_playlist(yt_pl_id, video_ids)
                stats["added"] += len(video_ids)

            pl.last_synced_at = datetime.utcnow()
            db.commit()

        log.status = "success"
    except Exception as e:
        db.rollback()
        log.status = "failed"
        log.error_message = str(e)
        stats["errors"].append(str(e))
    finally:
        log.stats = stats
        log.finished_at = datetime.utcnow()
        db.commit()
        db.close()
