# Voice AI Assistant - STT + LLM + TTS Pipeline

## Overview
Extended the STT app with a complete voice AI pipeline: Speech-to-Text → LLM (Ollama) → Text-to-Speech

## Features
- **Voice Chat**: Speak → AI responds with voice
- **Conversation Memory**: Context-aware responses via Ollama
- **TTS Response**: Coqui XTTS v2 for natural speech synthesis

## Architecture

```
User Speaks → Whisper (STT) → Ollama (LLM) → Coqui XTTS (TTS) → User Listens
```

## Backend Changes

### New Files
- `backend/app/services/ollama_service.py` - Ollama API client with streaming support
- `backend/app/services/tts_service.py` - Coqui XTTS v2 integration
- `backend/app/routers/voice_chat.py` - Voice pipeline API endpoints

### Modified Files
- `backend/app/main.py` - Added voice_chat router
- `backend/app/config.py` - Added Ollama and TTS settings
- `backend/requirements.txt` - Added httpx, TTS, numpy, scipy

### API Endpoints
- `POST /api/voice/chat` - Full voice pipeline
- `POST /api/voice/synthesize` - TTS only
- `GET /api/voice/audio/{file}` - Audio file retrieval
- `GET /api/voice/models` - Model info

## Frontend Changes

### New Files
- `frontend/src/components/VoiceChat/index.tsx` - Voice AI chat UI
- `frontend/src/components/AudioPlayer/index.tsx` - Audio playback with waveform

### Modified Files
- `frontend/src/App.tsx` - Added Voice AI mode tab
- `frontend/src/lib/api.ts` - Added voice API functions

## Infrastructure

### New Files
- `infra/docker-compose.yml` - Added Ollama service
- `infra/ollama-entrypoint.sh` - Model pull script
- `frontend/Dockerfile` - Frontend build container

### Modified Files
- `backend/Dockerfile` - Added TTS dependencies
- `infra/docker-compose.yml` - Added Ollama and audio volumes

## Configuration

### Environment Variables
```env
WHISPER_MODEL=base
WHISPER_DEVICE=cpu
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:1b
XTTS_MODEL=tts_models/en/xtts_v2
```

## Usage

### Docker Compose
```bash
cd infra
docker-compose up -d
```

### Manual Testing
```bash
# Test voice chat
curl -X POST -F "file=@audio.webm" http://localhost:8000/api/voice/chat

# Test TTS
curl -X POST -H "Content-Type: application/json" \
  -d '{"text":"Hello, how can I help you?"}' \
  http://localhost:8000/api/voice/synthesize
```

## Models Used
- **STT**: Faster-Whisper base (CPU optimized)
- **LLM**: llama3.2:1b (~700MB, Ollama)
- **TTS**: Coqui XTTS v2 (16 languages, voice cloning)