import redis
import json
from typing import Optional
from app.config import get_settings

settings = get_settings()

_redis_client = None


def get_redis_client() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


def set_job_progress(job_id: str, progress: float) -> None:
    client = get_redis_client()
    client.hset(f"job:{job_id}", "progress", str(progress))


def set_job_status(job_id: str, status: str) -> None:
    client = get_redis_client()
    client.hset(f"job:{job_id}", "status", status)


def set_job_segments(job_id: str, segments: list[dict]) -> None:
    client = get_redis_client()
    client.hset(f"job:{job_id}", "segments", json.dumps(segments))


def get_job_status(job_id: str) -> Optional[dict]:
    client = get_redis_client()
    data = client.hgetall(f"job:{job_id}")
    if not data:
        return None
    return {
        "status": data.get("status"),
        "progress": float(data.get("progress", 0)),
        "segments": json.loads(data.get("segments", "[]")),
        "error": data.get("error"),
    }


def set_job_error(job_id: str, error: str) -> None:
    client = get_redis_client()
    client.hset(f"job:{job_id}", "status", "error")
    client.hset(f"job:{job_id}", "error", error)
    client.expire(f"job:{job_id}", 86400)  # 24 hours TTL


def create_job(job_id: str) -> None:
    client = get_redis_client()
    client.hset(f"job:{job_id}", mapping={
        "status": "queued",
        "progress": "0",
        "segments": "[]",
    })
    client.expire(f"job:{job_id}", 86400)  # 24 hours TTL