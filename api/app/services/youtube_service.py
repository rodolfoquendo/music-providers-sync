import os
from typing import Optional
from ytmusicapi import YTMusic
from ..config import get_settings

_client: Optional[YTMusic] = None
_anon_client: Optional[YTMusic] = None


def get_client() -> Optional[YTMusic]:
    global _client
    if _client is not None:
        return _client
    auth_file = get_settings().ytmusic_auth_file
    if not os.path.exists(auth_file):
        return None
    try:
        _client = YTMusic(auth_file)
        return _client
    except Exception:
        return None


def is_connected() -> bool:
    return get_client() is not None


def search_track(title: str, artist: str) -> Optional[str]:
    """Return the best matching YouTube video ID for a track, or None."""
    yt = get_client()
    if not yt:
        return None
    try:
        results = yt.search(f"{title} {artist}", filter="songs", limit=1)
        if results:
            return results[0].get("videoId")
    except Exception:
        pass
    return None


def search_video(title: str, artist: str) -> Optional[str]:
    """Best matching YouTube *video* ID (music video), or None if there is no result.

    Raises on search errors so callers can tell "not found" from "failed".
    """
    global _anon_client
    yt = get_client()
    if not yt:
        if _anon_client is None:
            _anon_client = YTMusic()  # search needs no auth
        yt = _anon_client
    results = yt.search(f"{title} {artist}", filter="videos", limit=1)
    return results[0].get("videoId") if results else None


def get_playlists() -> list[dict]:
    yt = get_client()
    if not yt:
        return []
    try:
        return yt.get_library_playlists(limit=100)
    except Exception:
        return []


def get_playlist_tracks(playlist_id: str) -> list[dict]:
    yt = get_client()
    if not yt:
        return []
    try:
        result = yt.get_playlist(playlist_id, limit=500)
        return result.get("tracks", [])
    except Exception:
        return []


def create_or_get_playlist(name: str, description: str = "") -> Optional[str]:
    """Return existing playlist ID by name, or create a new one."""
    yt = get_client()
    if not yt:
        return None
    try:
        existing = yt.get_library_playlists(limit=100)
        for pl in existing:
            if pl.get("title", "").lower() == name.lower():
                return pl["playlistId"]
        return yt.create_playlist(name, description)
    except Exception:
        return None


def add_to_playlist(playlist_id: str, video_ids: list[str]) -> bool:
    yt = get_client()
    if not yt or not video_ids:
        return False
    try:
        yt.add_playlist_items(playlist_id, video_ids)
        return True
    except Exception:
        return False
