#!/bin/bash
# n8n 워크플로우 import 스크립트
# Usage: ./import-workflow.sh <workflow.json>

N8N_URL="${N8N_URL:-https://desilo-n8n.thengd.com}"
API_KEY="${N8N_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "❌ N8N_API_KEY 환경변수 필요"
  exit 1
fi

if [ -z "$1" ]; then
  echo "Usage: $0 <workflow.json>"
  exit 1
fi

curl -X POST "$N8N_URL/api/v1/workflows" \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: $API_KEY" \
  -d @"$1"

echo ""
