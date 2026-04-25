import os
import threading
from faster_whisper import WhisperModel
from app.config import get_settings

settings = get_settings()

_model = None
_lock = threading.Lock()


def get_whisper_model() -> WhisperModel:
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                _model = WhisperModel(
                    model_size_or_path=settings.whisper_model,
                    device=settings.whisper_device,
                    compute_type=settings.whisper_compute,
                    num_workers=2,
                )
    return _model


def get_model_info():
    return {
        "model": settings.whisper_model,
        "device": settings.whisper_device,
        "compute_type": settings.whisper_compute,
    }