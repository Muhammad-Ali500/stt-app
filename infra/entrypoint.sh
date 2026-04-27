#!/bin/bash
set -e

echo "Waiting for Ollama to be ready..."
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    echo "Ollama not ready, waiting..."
    sleep 5
done

echo "Pulling llama3.2:1b model..."
ollama pull llama3.2:1b

echo "Model ready!"
exec "$@"