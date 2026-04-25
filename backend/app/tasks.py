from fastapi import BackgroundTasks
from app.services import whisper, audio, redis_service
from app.models import SessionLocal, TranscriptionJob, TranscriptionSegmentDB, JobStatus
from app.config import get_settings
import uuid
import os

settings = get_settings()


def transcribe_file_task(job_id: str, file_path: str):
    db = SessionLocal()
    try:
        job = db.query(TranscriptionJob).filter(TranscriptionJob.id == job_id).first()
        if not job:
            return

        job.status = JobStatus.PROCESSING
        db.commit()
        redis_service.set_job_status(job_id, "processing")

        try:
            wav_path = audio.convert_to_wav(file_path)
            duration = audio.get_audio_duration(wav_path)

            model = whisper.get_whisper_model()
            segments, info = model.transcribe(
                wav_path,
                beam_size=5,
                word_timestamps=True,
                language=settings.whisper_language or None,
            )

            results = []
            for seg in segments:
                seg_data = {
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text,
                }
                results.append(seg_data)

                db_seg = TranscriptionSegmentDB(
                    job_id=job_id,
                    start=seg.start,
                    end=seg.end,
                    text=seg.text,
                )
                db.add(db_seg)

                if duration > 0:
                    progress = min(seg.end / duration, 1.0)
                    job.progress = progress
                    db.commit()
                    redis_service.set_job_progress(job_id, progress)

            job.status = JobStatus.COMPLETE
            job.progress = 1.0
            db.commit()
            redis_service.set_job_status(job_id, "complete")
            redis_service.set_job_segments(job_id, results)

        except Exception as e:
            job.status = JobStatus.ERROR
            job.error = str(e)
            db.commit()
            redis_service.set_job_error(job_id, str(e))
            raise

    finally:
        db.close()
        if os.path.exists(file_path):
            os.remove(file_path)


def create_transcription_task(filename: str, file_path: str):
    job_id = str(uuid.uuid4())
    db = SessionLocal()
    try:
        job = TranscriptionJob(id=job_id, filename=filename)
        db.add(job)
        db.commit()
        redis_service.create_job(job_id)
        return job_id
    finally:
        db.close()


def enqueue_transcription(background_tasks: BackgroundTasks, filename: str, file_path: str) -> str:
    job_id = create_transcription_task(filename, file_path)
    background_tasks.add_task(transcribe_file_task, job_id, file_path)
    return job_id