import os
import subprocess
import tempfile


def convert_to_wav(input_path: str, sample_rate: int = 16000, channels: int = 1) -> str:
    output_path = tempfile.mktemp(suffix=".wav")
    
    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-ar", str(sample_rate),
        "-ac", str(channels),
        "-acodec", "pcm_s16le",
        "-y",
        output_path
    ]
    
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg conversion failed: {result.stderr.decode()}")
    
    return output_path


def get_audio_duration(input_path: str) -> float:
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        input_path
    ]
    
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    
    if result.returncode != 0:
        return 0.0
    
    try:
        return float(result.stdout.decode().strip())
    except ValueError:
        return 0.0