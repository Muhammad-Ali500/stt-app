# Speech-to-Text App Implementation Plan

## Core Requirements
- CPU-only deployment (no GPU)
- Medium whisper model (medium-v3)
- Full production stack (DB, Redis) minus Celery/Prometheus/Grafana/Loki
- No authentication
- Both live + file upload transcription

## Tech Stack
| Layer | Technology |
|-------|------------|
| STT Engine | faster-whisper (medium-v3, CPU, int8) |
| Backend | FastAPI + uvicorn |
| Live STT | whisper-live WebSocket server |
| File Processing | FastAPI Background Tasks + Redis |
| Database | PostgreSQL |
| Cache/State | Redis |
| Frontend | React 18 + Vite + Tailwind + shadcn/ui |
| Waveform | wavesurfer.js |
| State | Zustand |
| Icons | lucide-react |

## Architecture

```
Browser ←→ Nginx ←→ FastAPI (REST + WebSocket)
                ↓
          Redis ←→ Background Task (transcribe file)
                ↓
          PostgreSQL (store jobs + transcripts)
```

## Implementation Phases

### Phase 1: Backend Setup (Day 1-2)
- [ ] Create FastAPI project structure
- [ ] Configure faster-whisper with medium model (CPU, int8)
- [ ] Set up PostgreSQL connection + models (jobs, transcripts)
- [ ] Set up Redis for state/caching
- [ ] Create health endpoint
- [ ] Test whisper inference locally

### Phase 2: File Upload API (Day 2-3)
- [ ] POST /api/transcribe/upload - save file, create job
- [ ] Background task: convert audio → 16kHz WAV → whisper
- [ ] Progress tracking via Redis
- [ ] GET /api/transcribe/{job_id}/status
- [ ] Segment-by-segment results with timestamps

### Phase 3: Live Transcription (Day 3-4)
- [ ] Set up whisper-live WebSocket server
- [ ] Client: AudioWorklet for PCM capture
- [ ] Real-time waveform visualization (wavesurfer.js)
- [ ] Interim + final text handling

### Phase 4: Frontend (Day 4-6)
- [ ] React + Vite + Tailwind setup
- [ ] shadcn/ui components
- [ ] Tab interface: Live / File Upload
- [ ] DropZone component for file upload
- [ ] Waveform canvas + transcript display
- [ ] Export: copy, download txt/srt/vtt

### Phase 5: Infrastructure (Day 6-7)
- [ ] Docker Compose configuration
- [ ] Nginx config (TLS, WebSocket proxy, static files)
- [ ] environment variables setup
- [ ] First deployment + testing

## Key Files to Create

```
backend/
├── app/
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── routers/
│   │   ├── transcribe.py    # Upload endpoints
│   │   └── health.py        # Health check
│   ├── services/
│   │   ├── whisper.py       # faster-whisper wrapper
│   │   └── audio.py         # ffmpeg conversion
│   └── tasks.py             # Background tasks
├── whisper_live.py          # WhisperLive server
├── requirements.txt
└── Dockerfile

frontend/
├── src/
│   ├── components/
│   │   ├── LiveTranscriber/
│   │   └── FileUploader/
│   ├── hooks/
│   ├── store/
│   ├── lib/
│   └── App.tsx
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── index.html

nginx/
└── nginx.conf

docker-compose.yml
.env.example
```

## Performance Targets (CPU)
- File upload: ≤3× audio duration
- First-word latency (live): <500ms
- Medium model: ~1.5GB RAM, moderate CPU usage

## Out of Scope (Skipped)
- Celery (using FastAPI background tasks instead)
- Prometheus/Grafana/Loki
- User authentication
- Large-v3 model (using medium)
