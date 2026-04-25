from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TranscriptionJobCreate(BaseModel):
    filename: str
    file_size: int


class TranscriptionSegment(BaseModel):
    start: float
    end: float
    text: str


class TranscriptionJobResponse(BaseModel):
    job_id: str
    status: str  # queued, processing, complete, error
    progress: float = 0.0
    eta_seconds: Optional[int] = None
    segments: list[TranscriptionSegment] = []
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class TranscriptionJobStatus(BaseModel):
    job_id: str
    status: str
    progress: float
    eta_seconds: Optional[int] = None
    segments: list[TranscriptionSegment] = []
    error: Optional[str] = None
    full_text: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    model: str
    device: str
    compute_type: str