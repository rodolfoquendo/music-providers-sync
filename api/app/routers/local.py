from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..config import get_settings
from ..services import local_service
from ..models import Track

router = APIRouter(prefix="/local", tags=["local"])


@router.get("/config")
def get_local_config():
    return {"music_local_path": get_settings().music_local_path}


@router.post("/scan")
def trigger_scan(db: Session = Depends(get_db)):
    folder = get_settings().music_local_path
    files = local_service.scan_folder(folder)
    added = 0
    updated = 0
    for data in files:
        existing = db.query(Track).filter(Track.local_path == data["local_path"]).first()
        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            updated += 1
        else:
            db.add(Track(**data))
            added += 1
    db.commit()
    return {"scanned": len(files), "added": added, "updated": updated}
