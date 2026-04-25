import argparse
import json
import numpy as np
import torch
import websockets
from faster_whisper import WhisperModel
from silero_vad import load_silero_vad
import asyncio
from collections import deque
from datetime import datetime

SAMPLE_RATE = 16000
CHUNK_DURATION = 0.5
CHUNK_SIZE = int(SAMPLE_RATE * CHUNK_DURATION)
MAX_BUFFER_DURATION = 10


class TranscriptionServer:
    def __init__(self, model_name="medium", device="cpu", compute_type="int8"):
        print(f"Loading Whisper model: {model_name} ({device}/{compute_type})...")
        self.model = WhisperModel(model_name, device=device, compute_type=compute_type)
        
        print("Loading VAD model...")
        self.vad_model = load_silero_vad()
        
        self.clients = set()
        self.client_buffers = {}
        
    async def handle_client(self, websocket):
        client_id = id(websocket)
        self.clients.add(websocket)
        self.client_buffers[client_id] = deque(maxlen=int(MAX_BUFFER_DURATION / CHUNK_DURATION))
        
        print(f"Client {client_id} connected")
        
        try:
            async for message in websocket:
                if isinstance(message, bytes):
                    audio_data = np.frombuffer(message, dtype=np.int16)
                    float_data = audio_data.astype(np.float32) / 32768.0
                    
                    self.client_buffers[client_id].append(float_data)
                    
                    audio_segment = np.concatenate(list(self.client_buffers[client_id]))
                    
                    if len(audio_segment) >= SAMPLE_RATE * 2:
                        await self.transcribe_segment(websocket, audio_segment)
                        
                elif isinstance(message, str):
                    data = json.loads(message)
                    
                    if data.get("type") == "config":
                        print(f"Client {client_id} sent config: {data}")
                    elif data.get("type") == "end_of_audio":
                        audio_segment = np.concatenate(list(self.client_buffers[client_id]))
                        if len(audio_segment) > 0:
                            await self.transcribe_segment(websocket, audio_segment, final=True)
                        
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.remove(websocket)
            del self.client_buffers[client_id]
            print(f"Client {client_id} disconnected")

    async def transcribe_segment(self, websocket, audio_segment, final=False):
        try:
            segments, _ = self.model.transcribe(
                audio_segment,
                language=None,
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=1000),
            )
            
            text_parts = []
            for segment in segments:
                text_parts.append(segment.text)
            
            if text_parts:
                full_text = " ".join(text_parts)
                response = {
                    "type": "final" if final else "partial",
                    "text": full_text.strip(),
                    "timestamp": datetime.utcnow().isoformat(),
                }
                await websocket.send(json.dumps(response))
                
        except Exception as e:
            error_msg = {"type": "error", "message": str(e)}
            await websocket.send(json.dumps(error_msg))


async def main(model_name, device, compute_type, host, port):
    server = TranscriptionServer(model_name, device, compute_type)
    
    print(f"Starting WebSocket server on {host}:{port}")
    
    async with websockets.serve(server.handle_client, host, port):
        await asyncio.Future()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind")
    parser.add_argument("--port", type=int, default=9090, help="Port to bind")
    parser.add_argument("--model", default="medium", help="Whisper model size")
    parser.add_argument("--device", default="cpu", help="Device (cpu/cuda)")
    parser.add_argument("--compute", default="int8", help="Compute type (int8/float16)")
    
    args = parser.parse_args()
    
    import os
    if os.getenv("WHISPER_MODEL"):
        args.model = os.getenv("WHISPER_MODEL")
    if os.getenv("WHISPER_DEVICE"):
        args.device = os.getenv("WHISPER_DEVICE")
    if os.getenv("WHISPER_COMPUTE"):
        args.compute = os.getenv("WHISPER_COMPUTE")
    
    asyncio.run(main(args.model, args.device, args.compute, args.host, args.port))