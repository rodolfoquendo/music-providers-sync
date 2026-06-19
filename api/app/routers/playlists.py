from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Playlist, PlaylistTrack
from ..schemas.playlist import PlaylistOut, PlaylistUpdate

router = APIRouter(prefix="/playlists", tags=["playlists"])


@router.get("", response_model=list[PlaylistOut])
def list_playlists(db: Session = Depends(get_db)):
    playlists = db.query(Playlist).order_by(Playlist.name).all()
    result = []
    for pl in playlists:
        count = db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == pl.id).count()
        out = PlaylistOut.model_validate(pl)
        out.track_count = count
        result.append(out)
    return result


@router.get("/{playlist_id}", response_model=PlaylistOut)
def get_playlist(playlist_id: int, db: Session = Depends(get_db)):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(404, "Playlist not found")
    count = db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == pl.id).count()
    out = PlaylistOut.model_validate(pl)
    out.track_count = count
    return out


@router.get("/{playlist_id}/track-ids")
def get_playlist_track_ids(playlist_id: int, db: Session = Depends(get_db)):
    """Return ordered track IDs for a playlist (used to load it into the player queue)."""
    rows = (
        db.query(PlaylistTrack.track_id)
        .filter(PlaylistTrack.playlist_id == playlist_id)
        .order_by(PlaylistTrack.position)
        .all()
    )
    return [r[0] for r in rows]


@router.patch("/{playlist_id}", response_model=PlaylistOut)
def update_playlist(playlist_id: int, body: PlaylistUpdate, db: Session = Depends(get_db)):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(404, "Playlist not found")
    if body.sync_enabled is not None:
        pl.sync_enabled = body.sync_enabled
    db.commit()
    db.refresh(pl)
    count = db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == pl.id).count()
    out = PlaylistOut.model_validate(pl)
    out.track_count = count
    return out
