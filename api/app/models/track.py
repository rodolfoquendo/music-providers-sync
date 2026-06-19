from sqlalchemy import BigInteger, Boolean, Column, Date, Integer, SmallInteger, String, Text, DateTime
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Track(Base):
    __tablename__ = "tracks"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    title = Column(String(500), nullable=False)
    artist = Column(String(500), nullable=False)
    artists_json = Column(JSON, nullable=True)
    album = Column(String(500), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    release_date = Column(Date, nullable=True)
    genres_json = Column(JSON, nullable=True)
    cover_url = Column(Text, nullable=True)
    popularity = Column(SmallInteger, nullable=True)
    explicit = Column(Boolean, default=False)

    # Spotify
    spotify_id = Column(String(100), unique=True, nullable=True, index=True)
    spotify_uri = Column(String(200), nullable=True)
    spotify_preview_url = Column(Text, nullable=True)

    # YouTube
    youtube_id = Column(String(100), nullable=True, index=True)
    youtube_url = Column(Text, nullable=True)

    # Local
    local_path = Column(Text, nullable=True)
    local_filename = Column(String(500), nullable=True)
    local_format = Column(String(20), nullable=True)
    local_bitrate = Column(Integer, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    playlist_tracks = relationship("PlaylistTrack", back_populates="track", cascade="all, delete-orphan")
