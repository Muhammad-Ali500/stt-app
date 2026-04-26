# Speech-to-Text (STT) Application

A full-featured open-source speech-to-text web application using Whisper for transcription. Supports both real-time microphone (live) transcription and audio file upload.

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Installation & Setup](#installation--setup)
6. [Production Deployment](#production-deployment)
7. [API Endpoints](#api-endpoints)
8. [Environment Variables](#environment-variables)
9. [Troubleshooting](#troubleshooting)
10. [License](#license)

---

## Features

- **Live Transcription**: Real-time speech-to-text using WebSocket connection
- **File Upload**: Drag & drop audio files (MP3, WAV, M4A, OGG, WEBM, FLAC, MP4)
- **Export Options**: TXT, SRT, VTT formats (file upload)
- **CPU-Optimized**: Runs efficiently on CPU using faster-whisper with int8 quantization
- **Modern UI**: React + Tailwind CSS with dark theme
- **SSL/HTTPS**: Let's Encrypt certificates via nginx

---

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| STT Engine | faster-whisper | 1.0.3 |
| Whisper Model | medium-v3 | - |
| VAD | silero-vad | 6.2.1 |
| Backend | FastAPI | 0.111.0 |
| Server | uvicorn | 0.31.0 |
| Database | SQLite (default) / PostgreSQL | - |
| Cache/State | Redis | 5.0.8 |
| Frontend | React | 18.3.1 |
| Build Tool | Vite | 5.3.1 |
| Styling | Tailwind CSS | 3.4.4 |
| WebSocket | websockets | 12.0 |
| Reverse Proxy | nginx | 1.24.0 |
| SSL | Let's Encrypt | certbot |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           INTERNET                                    │
│                     https://stt.dev-in.com                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         NGINX (Port 80/443)                          │
│                   TLS Termination + Reverse Proxy                  │
│    ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐   │
│    │ Frontend    │  │  /api/        │  │  /ws/ (WebSocket)    │   │
│    │ (Static)    │  │  (FastAPI)    │  │  (whisper-live)     │   │
│    └──────────────┘  └───────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
           │                    │                        │
           ▼                    ▼                        ▼
┌──────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐
│  /usr/share/     │  ���  FastAPI       │  │  whisper-live.py           │
│  nginx/html      │  │  (Port 8000)   │  │  (Port 9090)               │
│  (Static Files) │  │                │  │  + faster-whisper          │
│                 │  │  + SQLite/     │  │  + silero-vad             │
│                 │  │  + Redis        │  │                           │
└──────────────────┘  └─────────────────┘  └─────────────────────────────┘
                              │                        │
                              ▼                        ▼
                     ┌─────────────────┐  ┌─────────────────────────────┐
                     │  stt.db        │  │  Audio Processing          │
                     │  (SQLite)      │  │  + Model Download          │
                     └─────────────────┘  └─────────────────────────────┘
```

### Data Flow

1. **Frontend (Browser)**
   - User selects "Live" or "File Upload" mode
   - Live: Captures microphone audio via Web Audio API
   - File: Uploads audio file via REST API

2. **API Gateway (nginx)**
   - Serves static frontend files
   - Proxies `/api/*` to FastAPI backend
   - Proxies `/ws/*` to whisper-live WebSocket server

3. **FastAPI Backend**
   - Handles file upload requests
   - Stores jobs in SQLite (or PostgreSQL)
   - Uses Redis for real-time job status
   - Runs faster-whisper transcription in background tasks

4. **Whisper-Live WebSocket Server**
   - Receives real-time audio chunks
   - Uses silero-vad for voice activity detection
   - Processes with faster-whisper medium model
   - Sends partial/final transcriptions back

---

## Project Structure

```
stt-app/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── config.py            # Settings (pydantic-settings)
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── routers/
│   │   │   ├── transcribe.py    # Upload endpoints
│   │   │   └── health.py        # Health check
│   │   ├── services/
│   │   │   ├── whisper.py       # faster-whisper wrapper
│   │   │   ├── audio.py         # ffmpeg conversion
│   │   │   └── redis_service.py # Redis operations
│   │   └── tasks.py             # Background transcription tasks
│   ├── whisper_live.py          # WebSocket server for live STT
│   ├── stt.db                   # SQLite database
│   ├── requirements.txt         # Python dependencies
│   ├── Dockerfile              # Docker image
│   └── .env.example            # Environment template
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx            # React entry point
│   │   ├── App.tsx              # Main app component
│   │   ├── index.css            # Tailwind styles
│   │   ├── components/
│   │   │   ├── LiveTranscriber/ # Live mic transcription
│   │   │   └── FileUploader/     # File upload component
│   │   ├── lib/
│   │   │   ├── api.ts            # API client
│   │   │   ├── utils.ts         # Utilities (cn, formatFileSize)
│   │   │   └── providers.tsx    # React Query providers
│   │   └── store/
│   │       └── transcript.ts   # Zustand store
│   ├── public/
│   │   └── worklets/
│   │       └── pcm-processor.js # AudioWorklet for PCM
│   ├── dist/                   # Built production files
│   ├── package.json            # Node dependencies
│   ├── vite.config.ts          # Vite configuration
│   ├── tailwind.config.js     # Tailwind configuration
│   └── tsconfig.json           # TypeScript configuration
│
├── nginx/
│   └── nginx.conf               # nginx configuration (Docker)
│
├── infra/
│   └── docker-compose.yml      # Docker Compose stack
│
├── README.md                   # This documentation
└── CHANGELOG.md               # Change log
```

---

## Installation & Setup

### Prerequisites

```bash
# Required packages
- Python 3.12+
- Node.js 18+
- Redis (running on localhost:6379)
- nginx
- ffmpeg
- 4GB+ RAM (for Whisper medium model ~1.5GB)
```

### Backend Setup

```bash
# Navigate to backend
cd stt-app/backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env file (recommended values):
# WHISPER_MODEL=medium
# WHISPER_DEVICE=cpu
# WHISPER_COMPUTE=int8
# DATABASE_URL=sqlite:///./stt.db
# REDIS_URL=redis://localhost:6379/0
# CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]

# Create uploads directory
mkdir -p /tmp/uploads

# Start the backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
# Navigate to frontend
cd stt-app/frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Running without Docker

```bash
# 1. Start Redis (if not running)
redis-server --daemonize yes

# 2. Start backend
cd stt-app/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# 3. Start whisper-live WebSocket server
python whisper_live.py --host 0.0.0.0 --port 9090 &

# 4. Configure nginx with SSL
# Copy frontend dist to nginx html
cp -r frontend/dist/* /usr/share/nginx/html/

# Create nginx config (see nginx.conf below)

# 5. Start nginx
nginx -c /path/to/nginx.conf
```

---

## Production Deployment

### SSL Certificate with Let's Encrypt

```bash
# Install certbot
apt-get install -y certbot python3-certbot-nginx

# Get certificate (ensure port 80 is accessible)
certbot certonly --standalone -d stt.dev-in.com --non-interactive \
  --agree-tos --email admin@dev-in.com

# Certificate files are saved to:
# /etc/letsencrypt/live/stt.dev-in.com/
#   - fullchain.pem
#   - privkey.pem
```

### nginx Configuration

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;

    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    gzip on;
    gzip_types text/plain text/css application/json 
               application/javascript text/xml application/xml;

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name stt.dev-in.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl;
        server_name stt.dev-in.com;

        ssl_certificate /etc/letsencrypt/live/stt.dev-in.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/stt.dev-in.com/privkey.pem;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:
                     ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        client_max_body_size 500M;

        root /usr/share/nginx/html;
        index index.html;

        # CORS for assets
        location ~* \.(js|css|png|jpg|jpeg|svg|woff|woff2)$ {
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type";
        }

        # Frontend - serve static files or index.html for SPA
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API routes
        location /api/ {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # Health endpoint
        location /health {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;
        }

        # WebSocket
        location /ws/ {
            proxy_pass http://127.0.0.1:9090;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_read_timeout 3600s;
            proxy_connect_timeout 3600s;
        }
    }
}
```

### Service Management with systemd

```bash
# /etc/systemd/system/stt-api.service
[Unit]
Description=STT API Server
After=network.target redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/sst/stt-app/backend
ExecStart=/root/sst/stt-app/backend/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# /etc/systemd/system/stt-whisper-live.service
[Unit]
Description=STT Whisper Live WebSocket Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/sst/stt-app/backend
ExecStart=/root/sst/stt-app/backend/venv/bin/python whisper_live.py --host 0.0.0.0 --port 9090
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable services:
```bash
systemctl daemon-reload
systemctl enable stt-api stt-whisper-live
systemctl start stt-api stt-whisper-live
```

---

## API Endpoints

### Health Check

```bash
GET /health
# Response: {"status":"ok","model":"medium","device":"cpu","compute_type":"int8"}
```

### File Upload

```bash
POST /api/transcribe/upload
Content-Type: multipart/form-data

# Request
file: <audio file>

# Response
{
  "job_id": "uuid-string",
  "filename": "original-filename.mp3"
}
```

### Job Status

```bash
GET /api/transcribe/{job_id}/status

# Response (processing)
{
  "job_id": "uuid",
  "status": "processing",
  "progress": 0.45,
  "segments": [],
  "full_text": null
}

# Response (complete)
{
  "job_id": "uuid",
  "status": "complete",
  "progress": 1.0,
  "segments": [
    {"start": 0.0, "end": 2.5, "text": "Hello world"},
    {"start": 2.5, "end": 5.0, "text": "This is a test"}
  ],
  "full_text": "Hello world This is a test"
}
```

### WebSocket (Live Transcription)

```bash
# Connect to: wss://stt.dev-in.com/ws/

# Send audio (Int16Array PCM data)
ws.send(audioData)

# Receive transcription
{
  "type": "partial",
  "text": "Hello wor"
}

{
  "type": "final",
  "text": "Hello world"
}

# End transcription
ws.send(JSON.stringify({type: "end_of_audio"}))
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WHISPER_MODEL` | medium | Whisper model size (tiny, base, small, medium, large) |
| `WHISPER_DEVICE` | cpu | Device for inference (cpu, cuda) |
| `WHISPER_COMPUTE` | int8 | Compute type (int8, float16) |
| `WHISPER_LANGUAGE` | auto | Language code (e.g., "en") |
| `DATABASE_URL` | sqlite:///./stt.db | Database connection (SQLite or PostgreSQL) |
| `REDIS_URL` | redis://localhost:6379/0 | Redis connection |
| `MAX_UPLOAD_MB` | 500 | Maximum file upload size in MB |
| `UPLOAD_FOLDER` | /tmp/uploads | Temporary upload folder |
| `HOST` | 0.0.0.0 | Server host |
| `PORT` | 8000 | Server port |
| `CORS_ORIGINS` | ["http://localhost:5173"] | CORS allowed origins |

---

## Troubleshooting

### Issue: Frontend shows blank page

**Solution:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Check nginx error logs: `tail -f /var/log/nginx/error.log`
3. Verify assets are served: `curl https://stt.dev-in.com/assets/index-*.js`
4. Check CORS headers are set

### Issue: File upload returns 404

**Solution:**
1. Ensure nginx passes /api/ to FastAPI: `location /api/ { proxy_pass http://127.0.0.1:8000; }`
2. Check backend is running: `curl http://localhost:8000/health`

### Issue: Live transcription not working

**Solution:**
1. Check whisper-live is running: `ps aux | grep whisper_live`
2. Check WebSocket port: `ss -tlnp | grep 9090`
3. Check microphone permission in browser
4. Check console for JavaScript errors

### Issue: "port already in use"

**Solution:**
1. Find process: `lsof -i :8000` or `ss -tlnp | grep :8000`
2. Kill process: `kill <PID>`
3. Or use different port

### Issue: Redis connection error

**Solution:**
1. Check Redis is running: `redis-cli ping`
2. Start Redis: `redis-server --daemonize yes`

---

## License

MIT License - See LICENSE file for details