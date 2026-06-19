from datetime import date, datetime
from typing import Any, Optional
from pydantic import BaseModel


class TrackOut(BaseModel):
    id: int
    title: str
    artist: str
    artists_json: Optional[Any] = None
    album: Optional[str] = None
    duration_ms: Optional[int] = None
    release_date: Optional[date] = None
    genres_json: Optional[Any] = None
    cover_url: Optional[str] = None
    popularity: Optional[int] = None
    explicit: bool = False
    spotify_id: Optional[str] = None
    spotify_uri: Optional[str] = None
    spotify_preview_url: Optional[str] = None
    youtube_id: Optional[str] = None
    youtube_url: Optional[str] = None
    local_path: Optional[str] = None
    local_filename: Optional[str] = None
    local_format: Optional[str] = None
    local_bitrate: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TrackListOut(BaseModel):
    items: list[TrackOut]
    total: int
    page: int
    per_page: int
