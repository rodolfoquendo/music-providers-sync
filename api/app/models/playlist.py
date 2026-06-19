from sqlalchemy import BigInteger, Boolean, Column, DateTime, Enum, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    source = Column(Enum("spotify", "youtube", "local", "mixed"), nullable=False)
    source_id = Column(String(200), nullable=True, index=True)
    cover_url = Column(Text, nullable=True)
    sync_enabled = Column(Boolean, default=True)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    playlist_tracks = relationship("PlaylistTrack", back_populates="playlist", cascade="all, delete-orphan")
    sync_logs = relationship("SyncLog", back_populates="playlist")
