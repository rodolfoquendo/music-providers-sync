from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    playlist_id = Column(BigInteger, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = Column(BigInteger, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, default=0)
    added_at = Column(DateTime, server_default=func.now())

    playlist = relationship("Playlist", back_populates="playlist_tracks")
    track = relationship("Track", back_populates="playlist_tracks")
