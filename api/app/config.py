from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    db_host: str = "host.docker.internal"
    db_port: int = 3306
    db_name: str = "music"
    db_user: str = "platform"
    db_password: str = ""
    db_root_user: str = "root"
    db_root_password: str = ""

    # Spotify
    spotify_client_id: str = ""
    spotify_client_secret: str = ""
    spotify_redirect_uri: str = "https://localhost:8002/auth/spotify/callback"

    # YouTube Music — path to ytmusicapi auth JSON
    ytmusic_auth_file: str = "/app/ytmusic_auth.json"

    # Local music
    music_local_path: str = "/music"

    # App
    cors_origins: str = "http://localhost:3002,http://localhost:5173"
    secret_key: str = "change-me-in-production"

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
