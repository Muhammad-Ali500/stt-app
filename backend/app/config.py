from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Whisper
    whisper_model: str = "base"
    whisper_device: str = "cpu"
    whisper_compute: str = "int8"
    whisper_language: str = ""

    # Ollama
    ollama_url: str = "http://ollama:11434"
    ollama_model: str = "llama3.2:1b"
    ollama_timeout: int = 120

    # TTS (Coqui XTTS v2)
    xtts_model: str = "tts_models/en/xtts_v2"
    xtts_model_path: str = ""
    audio_output_folder: str = "/tmp/audio"

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