import os
import re
from datetime import datetime
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Track, Playlist, PlaylistTrack
from ..services import youtube_service, ytdlp_service
from ..schemas.track import TrackOut, TrackListOut, TrackVideoUpdate, TrackFromYoutube, YoutubeAddOut, TrackMetadataUpdate

router = APIRouter(prefix="/tracks", tags=["tracks"])


@router.get("", response_model=TrackListOut)
def list_tracks(
    q: str = Query("", description="Search title/artist"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    playlist_id: Optional[int] = Query(None, description="Only tracks of this playlist"),
    missing_video: bool = Query(False, description="Only tracks without a YouTube video match"),
    download: Optional[Literal["downloaded", "not_downloaded", "queued", "failed"]] = Query(None, description="Local file / download queue state"),
    sort: Literal["position", "title", "artist", "album", "duration", "added"] = Query("artist"),
    dir: Literal["asc", "desc"] = Query("asc"),
    db: Session = Depends(get_db),
):
    query = db.query(Track)
    if q:
        pattern = f"%{q}%"
        query = query.filter(or_(Track.title.ilike(pattern), Track.artist.ilike(pattern)))
    if playlist_id is not None:
        query = query.join(PlaylistTrack, PlaylistTrack.track_id == Track.id).filter(PlaylistTrack.playlist_id == playlist_id)
    if missing_video:
        query = query.filter(Track.youtube_video_id.is_(None))
    if download == "downloaded":
        query = query.filter(Track.local_path.isnot(None))
    elif download == "not_downloaded":
        query = query.filter(Track.local_path.is_(None))
    elif download == "queued":
        query = query.filter(Track.requested_download_at.isnot(None), Track.downloaded_at.is_(None), Track.download_error.is_(None))
    elif download == "failed":
        query = query.filter(Track.download_error.isnot(None))
    total = query.count()
    sort_col = {
        "position": PlaylistTrack.position if playlist_id is not None else Track.artist,
        "title": Track.title, "artist": Track.artist, "album": Track.album,
        "duration": Track.duration_ms, "added": Track.created_at,
    }[sort]
    primary = sort_col.desc() if dir == "desc" else sort_col.asc()
    # tie-breakers keep paging stable (many tracks share an album/added time)
    items = (
        query.order_by(primary, Track.artist, Track.title, Track.id)
        .offset((page - 1) * per_page).limit(per_page).all()
    )
    return TrackListOut(items=items, total=total, page=page, per_page=per_page)


@router.get("/ids")
def get_track_ids(sort: str = Query("id"), db: Session = Depends(get_db)):
    """Return all track IDs. sort=id (default) or sort=artist."""
    order = (Track.artist, Track.title) if sort == "artist" else (Track.id,)
    rows = db.query(Track.id).order_by(*order).all()
    return [r[0] for r in rows]


@router.get("/batch", response_model=list[TrackOut])
def get_tracks_batch(ids: str = Query(..., description="Comma-separated track IDs"), db: Session = Depends(get_db)):
    """Fetch multiple tracks by ID in one request, preserving the requested order."""
    id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
    if not id_list:
        return []
    rows = db.query(Track).filter(Track.id.in_(id_list)).all()
    by_id = {t.id: t for t in rows}
    return [by_id[i] for i in id_list if i in by_id]
    """Return all track IDs — used to build the shuffle queue client-side."""
    rows = db.query(Track.id).order_by(Track.id).all()
    return [r[0] for r in rows]


@router.get("/{track_id}", response_model=TrackOut)
def get_track(track_id: int, db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    return track


@router.get("/{track_id}/stream")
def stream_track(track_id: int, db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track or not track.local_path:
        raise HTTPException(404, "Local file not found")
    if not os.path.exists(track.local_path):
        raise HTTPException(404, "File missing on disk")

    ext = track.local_format or "mp3"
    media_types = {
        "mp3": "audio/mpeg", "flac": "audio/flac", "ogg": "audio/ogg",
        "m4a": "audio/mp4", "wav": "audio/wav", "aac": "audio/aac",
        "opus": "audio/opus", "wma": "audio/x-ms-wma",
    }
    content_type = media_types.get(ext, "audio/mpeg")

    # FileResponse supports HTTP Range, so the <audio> element can seek
    return FileResponse(track.local_path, media_type=content_type)


_VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_VIDEO_URL = re.compile(r"(?:v=|youtu\.be/|/embed/|/shorts/|/live/)([A-Za-z0-9_-]{11})")


def _parse_video_id(raw: str) -> Optional[str]:
    raw = raw.strip()
    m = _VIDEO_URL.search(raw)
    return m.group(1) if m else (raw if _VIDEO_ID.match(raw) else None)


MANUAL_PLAYLIST_NAME = "YouTube"
MANUAL_PLAYLIST_SOURCE_ID = "manual"


@router.post("/from-youtube", response_model=YoutubeAddOut)
def add_from_youtube(body: TrackFromYoutube, db: Session = Depends(get_db)):
    """Add a YouTube video as a track in the local-only "YouTube" playlist (never synced to Spotify)."""
    video_id = _parse_video_id(body.url)
    if not video_id:
        raise HTTPException(400, "Not a valid YouTube URL or video id")

    pl = db.query(Playlist).filter(Playlist.source == "youtube", Playlist.source_id == MANUAL_PLAYLIST_SOURCE_ID).first()
    if not pl:
        pl = Playlist(
            name=MANUAL_PLAYLIST_NAME, source="youtube", source_id=MANUAL_PLAYLIST_SOURCE_ID,
            description="Tracks added by hand from YouTube", sync_enabled=False,
        )
        db.add(pl)
        db.flush()

    track = db.query(Track).filter(or_(Track.youtube_video_id == video_id, Track.youtube_id == video_id)).first()
    existing = track is not None
    if not track:
        try:
            meta = ytdlp_service.fetch_metadata(video_id)
        except Exception as e:
            raise HTTPException(502, f"Could not read the YouTube video: {e}")
        track = Track(
            **meta,
            youtube_video_id=video_id,
            youtube_video_url=f"https://www.youtube.com/watch?v={video_id}",
            youtube_video_checked_at=datetime.utcnow(),
        )
        db.add(track)
        db.flush()

    if not db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == pl.id, PlaylistTrack.track_id == track.id).first():
        first = db.query(func.min(PlaylistTrack.position)).filter(PlaylistTrack.playlist_id == pl.id).scalar()
        # newest first: put it before everything already in the playlist
        db.add(PlaylistTrack(playlist_id=pl.id, track_id=track.id, position=(first if first is not None else 0) - 1))
    db.commit()
    db.refresh(track)
    return YoutubeAddOut(track=track, playlist_id=pl.id, existing=existing)


@router.patch("/{track_id}/metadata", response_model=TrackOut)
def update_metadata(track_id: int, body: TrackMetadataUpdate, db: Session = Depends(get_db)):
    """Fix title/artist/album of a hand-added track (Spotify tracks are owned by the Spotify sync)."""
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    if track.spotify_id:
        raise HTTPException(400, "Spotify tracks can't be edited; they are overwritten by the next sync")
    if body.title is not None:
        if not body.title.strip():
            raise HTTPException(400, "Title can't be empty")
        track.title = body.title.strip()[:500]
    if body.artist is not None:
        if not body.artist.strip():
            raise HTTPException(400, "Artist can't be empty")
        track.artist = body.artist.strip()[:500]
        track.artists_json = [a.strip() for a in track.artist.split(",")]
    if body.album is not None:
        track.album = body.album.strip()[:500] or None
    db.commit()
    db.refresh(track)
    return track


@router.patch("/{track_id}/youtube-video", response_model=TrackOut)
def set_youtube_video(track_id: int, body: TrackVideoUpdate, db: Session = Depends(get_db)):
    """Manually correct the YouTube video match of a track."""
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    raw = body.youtube_video_url.strip()
    if not raw:
        track.youtube_video_id = None
        track.youtube_video_url = None
        track.youtube_video_checked_at = datetime.utcnow()  # cleared on purpose: keep the worker from refilling it
    else:
        video_id = _parse_video_id(raw)
        if not video_id:
            raise HTTPException(400, "Not a valid YouTube URL or video id")
        track.youtube_video_id = video_id
        track.youtube_video_url = f"https://www.youtube.com/watch?v={video_id}"
    db.commit()
    db.refresh(track)
    return track


@router.post("/{track_id}/find-youtube-video", response_model=TrackOut)
def find_youtube_video(track_id: int, db: Session = Depends(get_db)):
    """Manual: search YouTube for this track's video right now and store the top match."""
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    try:
        video_id = youtube_service.search_video(track.title, track.artist)
    except Exception as e:
        raise HTTPException(502, f"YouTube search failed: {e}")
    if not video_id:
        raise HTTPException(404, "No YouTube video found for this track")
    track.youtube_video_id = video_id
    track.youtube_video_url = f"https://www.youtube.com/watch?v={video_id}"
    track.youtube_video_checked_at = datetime.utcnow()
    db.commit()
    db.refresh(track)
    return track


@router.post("/{track_id}/download", response_model=TrackOut)
def request_download(
    track_id: int,
    source: Literal["video", "audio"] = Query("video", description="video = youtube_video_id, audio = youtube_id (YTM)"),
    db: Session = Depends(get_db),
):
    """Manual: queue the track's YouTube version for download (128 kbps mp3). download_worker does the work."""
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    if not (track.youtube_video_id if source == "video" else track.youtube_id):
        raise HTTPException(400, f"Track has no YouTube {source} match")
    track.requested_download_at = datetime.utcnow()
    track.download_source = source
    track.downloaded_at = None
    track.download_error = None
    db.commit()
    db.refresh(track)
    return track
