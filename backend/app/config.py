from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Whisper
    whisper_model: str = "medium"
    whisper_device: str = "cpu"
    whisper_compute: str = "int8"
    whisper_language: str = ""

    # Database
    database_url: str = "sqlite:///./stt.db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Upload
    max_upload_mb: int = 500
    upload_folder: str = "/tmp/uploads"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()