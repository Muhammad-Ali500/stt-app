from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, status
from fastapi.responses import JSONResponse
import os
import uuid
from pathlib import Path

from app.schemas import TranscriptionJobStatus, TranscriptionJobResponse
from app.models import SessionLocal, TranscriptionJob, TranscriptionSegmentDB, JobStatus
from app.tasks import enqueue_transcription
from app.services import redis_service
from app.config import get_settings

router = APIRouter(prefix="/api/transcribe", tags=["transcribe"])
settings = get_settings()

Path(settings.upload_folder).mkdir(parents=True, exist_ok=True)


def get_full_text(job_id: str) -> str:
    db = SessionLocal()
    try:
        segments = db.query(TranscriptionSegmentDB).filter(
            TranscriptionSegmentDB.job_id == job_id
        ).order_by(TranscriptionSegmentDB.start).all()
        return " ".join(s.text for s in segments)
    finally:
        db.close()


@router.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if file.size and file.size > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {settings.max_upload_mb}MB"
        )

    file_ext = Path(file.filename).suffix.lower()
    allowed_exts = {".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac", ".mp4"}
    if file_ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {allowed_exts}"
        )

    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(settings.upload_folder, unique_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    job_id = enqueue_transcription(background_tasks, file.filename, file_path)

    return {"job_id": job_id, "filename": file.filename}


@router.get("/{job_id}/status", response_model=TranscriptionJobStatus)
async def get_job_status(job_id: str):
    job = redis_service.get_job_status(job_id)

    if job is None:
        db = SessionLocal()
        try:
            job_db = db.query(TranscriptionJob).filter(TranscriptionJob.id == job_id).first()
            if not job_db:
                raise HTTPException(status_code=404, detail="Job not found")
            
            segments = db.query(TranscriptionSegmentDB).filter(
                TranscriptionSegmentDB.job_id == job_id
            ).order_by(TranscriptionSegmentDB.start).all()

            from app.schemas import TranscriptionSegment
            segs = [TranscriptionSegment(start=s.start, end=s.end, text=s.text) for s in segments]

            return TranscriptionJobStatus(
                job_id=job_id,
                status=job_db.status.value,
                progress=job_db.progress,
                segments=segs,
                error=job_db.error,
                full_text=get_full_text(job_id),
            )
        finally:
            db.close()

    from app.schemas import TranscriptionSegment
    segs = [TranscriptionSegment(**s) for s in job.get("segments", [])]

    return TranscriptionJobStatus(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        segments=segs,
        error=job.get("error"),
    )


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    db = SessionLocal()
    try:
        job = db.query(TranscriptionJob).filter(TranscriptionJob.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        db.query(TranscriptionSegmentDB).filter(TranscriptionSegmentDB.job_id == job_id).delete()
        db.delete(job)
        db.commit()
        return {"message": "Job deleted"}
    finally:
        db.close()