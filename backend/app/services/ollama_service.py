import os
import json
import queue
import threading
from typing import Optional, Generator, AsyncGenerator
from dataclasses import dataclass, field
import httpx
from app.config import get_settings

settings = get_settings()


@dataclass
class Message:
    role: str
    content: str


@dataclass
class ConversationContext:
    messages: list[Message] = field(default_factory=list)
    max_history: int = 10


class OllamaService:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or settings.ollama_url
        self.client = httpx.Client(timeout=300.0)
        self._model: Optional[str] = None
        self._lock = threading.Lock()

    @property
    def model(self) -> str:
        if self._model is None:
            self._model = settings.ollama_model
        return self._model

    def is_available(self) -> bool:
        try:
            resp = self.client.get(f"{self.base_url}/api/tags")
            return resp.status_code == 200
        except Exception:
            return False

    def list_models(self) -> list[dict]:
        try:
            resp = self.client.get(f"{self.base_url}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                return data.get("models", [])
            return []
        except Exception:
            return []

    def generate_stream(
        self, prompt: str, system: Optional[str] = None, context: Optional[list] = None
    ) -> Generator[str, None, list]:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": True,
        }
        if system:
            payload["system"] = system
        if context:
            payload["context"] = context

        with self.client.stream("POST", f"{self.base_url}/api/generate", json=payload) as resp:
            full_context = []
            for line in resp.iter_lines():
                if line:
                    data = json.loads(line)
                    full_context = data.get("context", [])
                    yield data.get("response", "")

            return full_context

    def chat_stream(
        self, message: str, conversation: Optional[ConversationContext] = None
    ) -> Generator[str, None, ConversationContext]:
        system_prompt = """You are a helpful AI voice assistant. Keep responses concise and conversational,
since they will be converted to speech. Aim for 1-3 sentence responses."""

        messages = []
        if conversation and conversation.messages:
            messages = [
                {"role": m.role, "content": m.content}
                for m in conversation.messages[-conversation.max_history :]
            ]

        messages.append({"role": "user", "content": message})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        full_response = ""
        conversation = conversation or ConversationContext()

        with self.client.stream("POST", f"{self.base_url}/api/chat", json=payload) as resp:
            for line in resp.iter_lines():
                if line:
                    data = json.loads(line)
                    content = data.get("message", {}).get("content", "")
                    full_response += content
                    yield content

        conversation.messages.append(Message("user", message))
        conversation.messages.append(Message("assistant", full_response))
        if len(conversation.messages) > conversation.max_history * 2:
            conversation.messages = conversation.messages[-conversation.max_history * 2 :]

        return conversation

    def generate(self, prompt: str, system: Optional[str] = None) -> str:
        response_parts = []
        for part in self.generate_stream(prompt, system):
            response_parts.append(part)
        return "".join(response_parts)


_ollama_instance: Optional[OllamaService] = None
_conversation_store: dict[str, ConversationContext] = {}
_conv_lock = threading.Lock()


def get_ollama() -> OllamaService:
    global _ollama_instance
    if _ollama_instance is None:
        _ollama_instance = OllamaService()
    return _ollama_instance


def get_conversation(session_id: str) -> ConversationContext:
    with _conv_lock:
        if session_id not in _conversation_store:
            _conversation_store[session_id] = ConversationContext()
        return _conversation_store[session_id]


def clear_conversation(session_id: str) -> None:
    with _conv_lock:
        if session_id in _conversation_store:
            del _conversation_store[session_id]


def get_model_info() -> dict:
    ollama = get_ollama()
    return {
        "model": ollama.model,
        "available": ollama.is_available(),
        "url": ollama.base_url,
    }