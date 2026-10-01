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
    youtube_video_id: Optional[str] = None
    youtube_video_url: Optional[str] = None
    local_path: Optional[str] = None
    local_filename: Optional[str] = None
    local_format: Optional[str] = None
    local_bitrate: Optional[int] = None
    requested_download_at: Optional[datetime] = None
    download_source: Optional[str] = None
    downloaded_at: Optional[datetime] = None
    download_error: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TrackListOut(BaseModel):
    items: list[TrackOut]
    total: int
    page: int
    per_page: int


class TrackVideoUpdate(BaseModel):
    youtube_video_url: str  # any YouTube URL or bare 11-char video id; empty string clears it


class TrackFromYoutube(BaseModel):
    url: str  # any YouTube URL or bare 11-char video id


class YoutubeAddOut(BaseModel):
    track: TrackOut
    playlist_id: int
    existing: bool  # the track was already in the library; it was only linked to the playlist


class TrackMetadataUpdate(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None  # empty string clears it
