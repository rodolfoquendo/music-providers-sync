from fastapi import APIRouter
from ..services import youtube_service

router = APIRouter(prefix="/youtube", tags=["youtube"])


@router.get("/status")
def youtube_status():
    return {"connected": youtube_service.is_connected()}


@router.get("/playlists")
def list_youtube_playlists():
    return youtube_service.get_playlists()
