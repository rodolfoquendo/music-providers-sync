import json
import os
import requests
from typing import Optional
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from ..config import get_settings

CACHE_PATH = "/tmp/.spotify_token_cache"


def _get_oauth() -> SpotifyOAuth:
    s = get_settings()
    return SpotifyOAuth(
        client_id=s.spotify_client_id,
        client_secret=s.spotify_client_secret,
        redirect_uri=s.spotify_redirect_uri,
        scope=(
            "user-library-read playlist-read-private playlist-read-collaborative "
            "streaming user-read-email user-read-private "
            "user-read-playback-state user-modify-playback-state"
        ),
        cache_path=CACHE_PATH,
        open_browser=False,
    )


def get_auth_url() -> str:
    return _get_oauth().get_authorize_url()


def exchange_code(code: str) -> dict:
    oauth = _get_oauth()
    token_info = oauth.get_access_token(code, as_dict=True)
    return token_info


def get_client() -> Optional[spotipy.Spotify]:
    oauth = _get_oauth()
    token_info = oauth.get_cached_token()
    if not token_info:
        return None
    if oauth.is_token_expired(token_info):
        token_info = oauth.refresh_access_token(token_info["refresh_token"])
    return spotipy.Spotify(auth=token_info["access_token"])


def is_connected() -> bool:
    return get_client() is not None


def get_current_user() -> Optional[dict]:
    sp = get_client()
    if not sp:
        return None
    return sp.current_user()


def get_liked_songs() -> list[dict]:
    sp = get_client()
    if not sp:
        return []
    tracks = []
    offset = 0
    limit = 50
    while True:
        result = sp.current_user_saved_tracks(limit=limit, offset=offset)
        items = result.get("items", [])
        tracks.extend(items)
        if len(items) < limit:
            break
        offset += limit
    return tracks


def get_playlists() -> list[dict]:
    sp = get_client()
    if not sp:
        return []
    playlists = []
    offset = 0
    limit = 50
    while True:
        result = sp.current_user_playlists(limit=limit, offset=offset)
        items = result.get("items", [])
        playlists.extend(items)
        if len(items) < limit:
            break
        offset += limit
    return playlists


def _get_access_token() -> Optional[str]:
    oauth = _get_oauth()
    token_info = oauth.get_cached_token()
    if not token_info:
        return None
    if oauth.is_token_expired(token_info):
        token_info = oauth.refresh_access_token(token_info["refresh_token"])
    return token_info["access_token"]


def get_playlist_tracks(playlist_id: str) -> list[dict]:
    """Fetch playlist items using the /items endpoint (replaces deprecated /tracks)."""
    token = _get_access_token()
    if not token:
        return []
    items = []
    url = f"https://api.spotify.com/v1/playlists/{playlist_id}/items"
    params = {"limit": 100, "offset": 0}
    headers = {"Authorization": f"Bearer {token}"}
    while url:
        resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()
        batch = data.get("items", [])
        items.extend(batch)
        # Follow pagination via `next`; clear params so the next URL is used as-is
        url = data.get("next")
        params = {}
    return items


def parse_track(item: dict) -> dict:
    """Normalize a Spotify track item (from liked songs or playlist /items) to a flat dict."""
    # /me/tracks returns {"track": {...}}, /playlists/{id}/items returns {"item": {...}}
    track = item.get("track") or item.get("item") or item
    if not track or not track.get("id"):
        return {}
    artists = track.get("artists", [])
    album = track.get("album", {})
    release_raw = album.get("release_date", "")
    release_date = None
    if release_raw:
        parts = release_raw.split("-")
        if len(parts) == 3:
            release_date = release_raw
        elif len(parts) == 2:
            release_date = f"{release_raw}-01"
        elif len(parts) == 1:
            release_date = f"{release_raw}-01-01"

    images = album.get("images", [])
    cover_url = images[0]["url"] if images else None

    return {
        "spotify_id": track["id"],
        "spotify_uri": track.get("uri"),
        "spotify_preview_url": track.get("preview_url"),
        "title": track.get("name", ""),
        "artist": artists[0]["name"] if artists else "Unknown",
        "artists_json": [a["name"] for a in artists],
        "album": album.get("name"),
        "duration_ms": track.get("duration_ms"),
        "release_date": release_date,
        "cover_url": cover_url,
        "popularity": track.get("popularity"),
        "explicit": track.get("explicit", False),
        "genres_json": [],
    }
