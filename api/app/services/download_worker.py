import logging
import threading
from datetime import datetime
from ..config import get_settings
from ..database import SessionLocal
from ..models import Track
from . import ytdlp_service

log = logging.getLogger("download_worker")

IDLE_SECONDS = 5

_stop = threading.Event()
_thread: threading.Thread | None = None


def start():
    global _thread
    if not get_settings().download_worker_enabled or (_thread and _thread.is_alive()):
        return
    _stop.clear()
    _thread = threading.Thread(target=_run, name="download-worker", daemon=True)
    _thread.start()


def stop():
    _stop.set()


def is_running() -> bool:
    return bool(_thread and _thread.is_alive())


def _run():
    log.info("started")
    while not _stop.is_set():
        try:
            worked = _process_next()
        except Exception:
            log.exception("download loop failed")
            worked = False
        if not worked:
            _stop.wait(IDLE_SECONDS)
    log.info("stopped")


def _process_next() -> bool:
    """Download the oldest requested track. Returns False when the queue is empty."""
    db = SessionLocal()
    try:
        track = (
            db.query(Track)
            .filter(
                Track.requested_download_at.isnot(None),
                Track.downloaded_at.is_(None),
                Track.download_error.is_(None),
            )
            .order_by(Track.requested_download_at, Track.id)
            .first()
        )
        if not track:
            return False
        try:
            youtube_id = track.youtube_video_id if track.download_source == "video" else track.youtube_id
            if not youtube_id:
                raise RuntimeError(f"Track has no YouTube {track.download_source} match")
            fields = ytdlp_service.download_track(track, youtube_id)
            for k, v in fields.items():
                setattr(track, k, v)
            track.downloaded_at = datetime.utcnow()
            db.commit()
            log.info("downloaded track %s", track.id)
        except Exception as e:
            db.rollback()
            track = db.query(Track).filter(Track.id == track.id).first()
            track.download_error = str(e)[:1000]  # park it; re-requesting clears the error
            db.commit()
            log.warning("download failed for track %s: %s", track.id, e)
        return True
    finally:
        db.close()
