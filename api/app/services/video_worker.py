import logging
import threading
from datetime import datetime
from ..config import get_settings
from ..database import SessionLocal
from ..models import Track
from . import youtube_service

log = logging.getLogger("video_worker")

BATCH = 50
IDLE_SECONDS = 60
ERROR_BACKOFF_SECONDS = 60

_stop = threading.Event()
_thread: threading.Thread | None = None


def start():
    global _thread
    if not get_settings().youtube_video_worker_enabled or (_thread and _thread.is_alive()):
        return
    _stop.clear()
    _thread = threading.Thread(target=_run, name="youtube-video-worker", daemon=True)
    _thread.start()


def stop():
    _stop.set()


def is_running() -> bool:
    return bool(_thread and _thread.is_alive())


def _run():
    delay = get_settings().youtube_video_worker_delay
    log.info("started")
    while not _stop.is_set():
        try:
            worked = _process_batch(delay)
        except Exception:
            log.exception("batch failed")
            _stop.wait(ERROR_BACKOFF_SECONDS)
            continue
        if not worked:
            _stop.wait(IDLE_SECONDS)  # nothing pending; new Spotify imports will show up here
    log.info("stopped")


def _process_batch(delay: float) -> bool:
    """Fill the YouTube video for up to BATCH pending tracks. Returns False when nothing was pending."""
    db = SessionLocal()
    try:
        ids = [
            r[0] for r in db.query(Track.id)
            .filter(Track.youtube_video_id.is_(None), Track.youtube_video_checked_at.is_(None))
            .order_by(Track.id).limit(BATCH).all()
        ]
        for track_id in ids:
            if _stop.is_set():
                return True
            track = db.query(Track).filter(Track.id == track_id).first()
            try:
                video_id = youtube_service.search_video(track.title, track.artist)
            except Exception as e:
                # search failed (rate limit, network): leave unchecked so it is retried, and back off
                db.rollback()
                log.warning("search failed for track %s: %s", track_id, e)
                _stop.wait(ERROR_BACKOFF_SECONDS)
                return True
            if video_id:
                track.youtube_video_id = video_id
                track.youtube_video_url = f"https://www.youtube.com/watch?v={video_id}"
            track.youtube_video_checked_at = datetime.utcnow()  # also set when nothing found: don't retry forever
            db.commit()
            _stop.wait(delay)
        return bool(ids)
    finally:
        db.close()
