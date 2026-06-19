from fastapi import APIRouter
from fastapi.responses import RedirectResponse, JSONResponse
from ..services import spotify_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/spotify/login")
def spotify_login():
    url = spotify_service.get_auth_url()
    return RedirectResponse(url)


@router.get("/spotify/callback")
def spotify_callback(code: str):
    spotify_service.exchange_code(code)
    return RedirectResponse("http://localhost:3002?spotify=connected")


@router.get("/spotify/status")
def spotify_status():
    connected = spotify_service.is_connected()
    user = spotify_service.get_current_user() if connected else None
    return {"connected": connected, "user": user}


@router.delete("/spotify/disconnect")
def spotify_disconnect():
    import os
    cache = spotify_service.CACHE_PATH
    if os.path.exists(cache):
        os.remove(cache)
    return {"disconnected": True}
