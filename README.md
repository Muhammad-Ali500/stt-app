# Speech-to-Text App

Open-source speech-to-text web application using Whisper for transcription. Supports both real-time microphone transcription and audio file upload.

## Features

- **Live Transcription**: Real-time speech-to-text using WebSocket
- **File Upload**: Drag & drop audio files (MP3, WAV, M4A, OGG, WEBM, FLAC)
- **Export Options**: Download transcripts as TXT, SRT, or VTT
- **CPU-Ready**: Runs on CPU with optimized faster-whisper

## Tech Stack

| Component | Technology |
|-----------|------------|
| STT Engine | faster-whisper (medium model) |
| Backend | FastAPI |
| Database | PostgreSQL |
| Cache | Redis |
| Frontend | React + Vite + Tailwind |
| Audio Visualization | wavesurfer.js |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- 4GB+ RAM recommended for Whisper medium model

### Running with Docker

```bash
# Clone and navigate to project
cd realtime-speech

# Copy environment file
cp backend/.env.example backend/.env

# Build and start all services
docker compose -f infra/docker-compose.yml up --build

# Access the app at http://localhost
```

### Development Mode

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WHISPER_MODEL` | medium | Whisper model size |
| `WHISPER_DEVICE` | cpu | Device (cpu/cuda) |
| `WHISPER_COMPUTE` | int8 | Compute type |
| `DATABASE_URL` | postgresql://... | PostgreSQL connection |
| `REDIS_URL` | redis://... | Redis connection |

## API Endpoints

- `POST /api/transcribe/upload` - Upload audio file
- `GET /api/transcribe/{job_id}/status` - Get job status
- `GET /api/health` - Health check
- `WS /ws/live` - Live transcription WebSocket

## License

MIT