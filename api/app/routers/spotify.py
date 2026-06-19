import requests as http
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services import spotify_service

router = APIRouter(prefix="/spotify", tags=["spotify"])

SPOTIFY_API = "https://api.spotify.com/v1"


def _auth_headers() -> dict:
    token = spotify_service._get_access_token()
    if not token:
        raise HTTPException(401, "Spotify not connected")
    return {"Authorization": f"Bearer {token}"}


@router.get("/playlists")
def list_spotify_playlists():
    return spotify_service.get_playlists()


@router.get("/token")
def get_spotify_token():
    """Return a fresh Spotify access token for the Web Playback SDK."""
    token = spotify_service._get_access_token()
    return {"token": token}


@router.get("/devices")
def get_spotify_devices():
    """List available Spotify playback devices."""
    resp = http.get(f"{SPOTIFY_API}/me/player/devices", headers=_auth_headers())
    if resp.status_code == 204:
        return {"devices": []}
    resp.raise_for_status()
    return resp.json()


@router.get("/currently-playing")
def get_currently_playing():
    """Return the track currently playing on any Spotify device."""
    resp = http.get(f"{SPOTIFY_API}/me/player/currently-playing", headers=_auth_headers())
    if resp.status_code == 204:
        return None
    resp.raise_for_status()
    data = resp.json()
    item = data.get("item") or {}
    return {
        "spotify_id": item.get("id"),
        "spotify_uri": item.get("uri"),
        "title": item.get("name"),
        "artist": (item.get("artists") or [{}])[0].get("name"),
        "cover_url": ((item.get("album") or {}).get("images") or [{}])[0].get("url"),
        "duration_ms": item.get("duration_ms"),
        "progress_ms": data.get("progress_ms", 0),
        "is_playing": data.get("is_playing", False),
        "device": (data.get("device") or {}).get("name"),
    }


class TransferBody(BaseModel):
    device_id: str
    play: bool = True


@router.post("/transfer")
def transfer_playback(body: TransferBody):
    """Transfer Spotify playback to the specified device."""
    resp = http.put(
        f"{SPOTIFY_API}/me/player",
        headers={**_auth_headers(), "Content-Type": "application/json"},
        json={"device_ids": [body.device_id], "play": body.play},
    )
    if resp.status_code in (200, 202, 204):
        return {"ok": True}
    raise HTTPException(resp.status_code, resp.text)
