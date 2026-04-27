import os
import io
import uuid
import tempfile
import threading
from typing import Optional
import numpy as np
import wave
import scipy.io.wavfile as wavfile
from app.config import get_settings

settings = get_settings()

_tts_model = None
_tts_lock = threading.Lock()


class TTSService:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.xtts_model_path
        self.sample_rate = 24000
        self._model = None
        self._speaker_wav = None
        self._speaker_latents = None

    def _load_model(self):
        if self._model is None:
            with _tts_lock:
                if self._model is None:
                    from TTS.api import TTS

                    self._model = TTS(self.model_path)
                    self._model.to(self._model.device)

    def synthesize(
        self,
        text: str,
        voice_reference: Optional[str] = None,
        language: str = "en",
    ) -> bytes:
        self._load_model()

        if voice_reference:
            wav_out = self._model.tts(
                text=text,
                speaker_wav=voice_reference,
                language=language,
            )
        else:
            wav_out = self._model.tts(text=text, language=language)

        if isinstance(wav_out, np.ndarray):
            audio_data = wav_out
        else:
            audio_data = np.array(wav_out)

        audio_bytes = self._array_to_wav(audio_data, self.sample_rate)
        return audio_bytes

    def synthesize_to_file(
        self,
        text: str,
        output_path: str,
        voice_reference: Optional[str] = None,
        language: str = "en",
    ) -> str:
        audio_bytes = self.synthesize(text, voice_reference, language)
        with open(output_path, "wb") as f:
            f.write(audio_bytes)
        return output_path

    def _array_to_wav(self, audio_array: np.ndarray, sample_rate: int) -> bytes:
        if audio_array.ndim > 1:
            audio_array = audio_array.mean(axis=1)

        audio_array = np.clip(audio_array, -1.0, 1.0)
        audio_int16 = (audio_array * 32767).astype(np.int16)

        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(audio_int16.tobytes())

        return buffer.getvalue()


_tts_instance: Optional[TTSService] = None


def get_tts() -> TTSService:
    global _tts_instance
    if _tts_instance is None:
        _tts_instance = TTSService()
    return _tts_instance


def synthesize_speech(
    text: str,
    voice_reference: Optional[str] = None,
    output_file: Optional[str] = None,
) -> tuple[bytes, str]:
    tts = get_tts()

    if not output_file:
        audio_dir = settings.audio_output_folder
        os.makedirs(audio_dir, exist_ok=True)
        output_file = os.path.join(audio_dir, f"tts_{uuid.uuid4().hex}.wav")

    audio_bytes = tts.synthesize_to_file(
        text=text,
        output_path=output_file,
        voice_reference=voice_reference,
    )

    return audio_bytes, output_file


def get_tts_model_info() -> dict:
    return {
        "model": settings.xtts_model,
        "sample_rate": 24000,
        "languages": ["en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "zh", "ja", "hu", "ko"],
    }