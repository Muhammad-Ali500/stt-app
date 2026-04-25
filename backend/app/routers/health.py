from fastapi import APIRouter, Depends
from app.schemas import HealthResponse
from app.services import whisper

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    info = whisper.get_model_info()
    return HealthResponse(
        status="ok",
        model=info["model"],
        device=info["device"],
        compute_type=info["compute_type"],
    )