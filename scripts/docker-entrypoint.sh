#!/bin/sh
set -e

echo "🚀 Starting n8n with pre-loaded workflows..."

# n8n 시작 (백그라운드)
n8n start &
N8N_PID=$!

# n8n이 준비될 때까지 대기
echo "⏳ Waiting for n8n to be ready..."
until curl -s http://localhost:5678/healthz > /dev/null 2>&1; do
  sleep 2
done
echo "✅ n8n is ready!"

# 워크플로우 import
if [ -d "/workflows" ]; then
  for f in /workflows/*.json; do
    if [ -f "$f" ]; then
      echo "📥 Importing: $f"
      n8n import:workflow --input="$f" || true
    fi
  done
  echo "✅ Workflows imported!"
fi

# foreground로 전환
wait $N8N_PID
