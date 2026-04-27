FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY whisper_live.py .

RUN mkdir -p /tmp/audio && chmod 777 /tmp/audio

ENV PYTHONPATH=/app
ENV WHISPER_MODEL=base
ENV WHISPER_DEVICE=cpu
ENV WHISPER_COMPUTE=int8
ENV OLLAMA_URL=http://ollama:11434
ENV OLLAMA_MODEL=llama3.2:1b
ENV XTTS_MODEL=tts_models/en/xtts_v2
ENV AUDIO_OUTPUT_FOLDER=/tmp/audio

EXPOSE 8000 9090

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]