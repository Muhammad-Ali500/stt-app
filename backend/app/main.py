from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.models import init_db
from app.routers import health, transcribe, voice_chat

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Voice AI Assistant API",
    description="STT → LLM (Ollama) → TTS Pipeline",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(transcribe.router)
app.include_router(voice_chat.router)


@app.get("/")
async def root():
    return {
        "message": "Voice AI Assistant API",
        "docs": "/docs",
        "features": ["STT", "LLM (Ollama)", "TTS"]
    }