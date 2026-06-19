import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Track
from ..schemas.track import TrackOut, TrackListOut

router = APIRouter(prefix="/tracks", tags=["tracks"])


@router.get("", response_model=TrackListOut)
def list_tracks(
    q: str = Query("", description="Search title/artist"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Track)
    if q:
        pattern = f"%{q}%"
        query = query.filter(or_(Track.title.ilike(pattern), Track.artist.ilike(pattern)))
    total = query.count()
    items = query.order_by(Track.artist, Track.title).offset((page - 1) * per_page).limit(per_page).all()
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

    def iterfile():
        with open(track.local_path, "rb") as f:
            while chunk := f.read(65536):
                yield chunk

    return StreamingResponse(iterfile(), media_type=content_type)
