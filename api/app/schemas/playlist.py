from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel


class PlaylistOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    source: Literal["spotify", "youtube", "local", "mixed"]
    source_id: Optional[str] = None
    cover_url: Optional[str] = None
    sync_enabled: bool = True
    last_synced_at: Optional[datetime] = None
    track_count: int = 0

    model_config = {"from_attributes": True}


class PlaylistUpdate(BaseModel):
    sync_enabled: Optional[bool] = None
