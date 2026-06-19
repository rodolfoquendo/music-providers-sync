from sqlalchemy import BigInteger, Column, DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    direction = Column(Enum("spotify_import", "youtube_export", "local_scan"), nullable=False)
    status = Column(Enum("pending", "running", "success", "failed"), default="pending")
    playlist_id = Column(BigInteger, ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True)
    stats = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, server_default=func.now())
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    playlist = relationship("Playlist", back_populates="sync_logs")
