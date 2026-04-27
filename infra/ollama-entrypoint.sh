#!/bin/bash
set -e

if [ "$PULL_MODEL" = "true" ]; then
    echo "Waiting for Ollama service..."
    until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
        echo "Ollama not ready, waiting..."
        sleep 5
    done

    echo "Pulling $OLLAMA_MODEL model..."
    ollama pull "$OLLAMA_MODEL" || echo "Model may already exist or pull failed"
    echo "Ollama setup complete!"
fi

exec "$@"