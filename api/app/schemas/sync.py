from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel


class SyncRequest(BaseModel):
    playlist_ids: Optional[list[int]] = None  # None = all enabled playlists


class SyncLogOut(BaseModel):
    id: int
    direction: Literal["spotify_import", "youtube_export", "local_scan"]
    status: Literal["pending", "running", "success", "failed"]
    playlist_id: Optional[int] = None
    stats: Optional[Any] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
