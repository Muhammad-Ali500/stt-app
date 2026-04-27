import os
import io
import uuid
import wave
import base64
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, status
from fastapi.responses import FileResponse, JSONResponse
import numpy as np

from app.schemas import TranscriptionSegment
from app.config import get_settings
from app.services.ollama_service import (
    get_ollama,
    get_conversation,
    clear_conversation,
    get_model_info as get_ollama_info,
)
from app.services.tts_service import get_tts, get_tts_model_info

settings = get_settings()
router = APIRouter(prefix="/api/voice", tags=["voice"])

Path(settings.upload_folder).mkdir(parents=True, exist_ok=True)
Path(settings.audio_output_folder).mkdir(parents=True, exist_ok=True)


def convert_webm_to_wav(audio_bytes: bytes, target_sample_rate: int = 16000) -> np.ndarray:
    import tempfile
    import subprocess

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as inp:
        inp.write(audio_bytes)
        inp_path = inp.name

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out:
        out_path = out.name

    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", inp_path,
                "-ar", str(target_sample_rate),
                "-ac", "1",
                out_path
            ],
            check=True,
            capture_output=True,
        )

        with wave.open(out_path, "rb") as wf:
            sample_rate = wf.getframerate()
            frames = wf.readframes(wf.getnframes())
            audio_data = np.frombuffer(frames, dtype=np.int16)
            audio_float = audio_data.astype(np.float32) / 32768.0

        return audio_float
    finally:
        os.unlink(inp_path)
        if os.path.exists(out_path):
            os.unlink(out_path)


def transcribe_audio(audio_data: np.ndarray, sample_rate: int = 16000) -> str:
    from faster_whisper import WhisperModel

    model = WhisperModel(
        settings.whisper_model,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute,
    )

    segments, info = model.transcribe(
        audio_data,
        language=settings.whisper_language or None,
        task="transcribe",
    )

    text_parts = []
    for segment in segments:
        text_parts.append(segment.text)

    return " ".join(text_parts).strip()


@router.post("/chat")
async def voice_chat(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session_id: Optional[str] = None,
):
    if not session_id:
        session_id = str(uuid.uuid4())

    try:
        audio_bytes = await file.read()
        if len(audio_bytes) < 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Audio file too small or empty"
            )

        audio_data = convert_webm_to_wav(audio_bytes)

        if audio_data.size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to process audio file"
            )

        transcribed_text = transcribe_audio(audio_data)

        if not transcribed_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not transcribe audio"
            )

        ollama = get_ollama()
        if not ollama.is_available():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Ollama service not available"
            )

        conversation = get_conversation(session_id)
        response_text = ""
        for chunk in ollama.chat_stream(transcribed_text, conversation):
            response_text += chunk

        tts = get_tts()
        audio_output = os.path.join(
            settings.audio_output_folder,
            f"response_{uuid.uuid4().hex}.wav"
        )
        tts.synthesize_to_file(response_text, audio_output)

        return JSONResponse({
            "session_id": session_id,
            "transcribed_text": transcribed_text,
            "response_text": response_text,
            "audio_url": f"/api/voice/audio/{Path(audio_output).name}",
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Processing failed: {str(e)}"
        )


@router.post("/chat/stream")
async def voice_chat_stream(
    file: UploadFile = File(...),
    session_id: Optional[str] = None,
):
    if not session_id:
        session_id = str(uuid.uuid4())

    try:
        audio_bytes = await file.read()
        audio_data = convert_webm_to_wav(audio_bytes)

        transcribed_text = transcribe_audio(audio_data)

        ollama = get_ollama()
        if not ollama.is_available():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Ollama service not available"
            )

        conversation = get_conversation(session_id)
        response_text = ""
        for chunk in ollama.chat_stream(transcribed_text, conversation):
            response_text += chunk

        tts = get_tts()
        audio_output = os.path.join(
            settings.audio_output_folder,
            f"response_{uuid.uuid4().hex}.wav"
        )
        tts.synthesize_to_file(response_text, audio_output)

        with open(audio_output, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode()

        return JSONResponse({
            "session_id": session_id,
            "transcribed_text": transcribed_text,
            "response_text": response_text,
            "audio_base64": audio_b64,
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Processing failed: {str(e)}"
        )


@router.post("/synthesize")
async def synthesize_speech(text: str, language: str = "en"):
    if not text or len(text.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text is required"
        )

    try:
        tts = get_tts()
        audio_output = os.path.join(
            settings.audio_output_folder,
            f"tts_{uuid.uuid4().hex}.wav"
        )
        tts.synthesize_to_file(text, audio_output, language=language)

        return FileResponse(
            audio_output,
            media_type="audio/wav",
            filename=f"speech.wav",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Synthesis failed: {str(e)}"
        )


@router.get("/audio/{filename}")
async def get_audio(filename: str):
    safe_filename = os.path.basename(filename)
    audio_path = os.path.join(settings.audio_output_folder, safe_filename)

    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Audio not found")

    return FileResponse(audio_path, media_type="audio/wav")


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    clear_conversation(session_id)
    return {"message": "Session cleared"}


@router.get("/models")
async def get_model_info():
    return {
        "stt": {
            "model": settings.whisper_model,
            "device": settings.whisper_device,
        },
        "llm": get_ollama_info(),
        "tts": get_tts_model_info(),
    }