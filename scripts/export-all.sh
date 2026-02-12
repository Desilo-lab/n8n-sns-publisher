#!/bin/bash
# 모든 워크플로우 export
N8N_URL="${N8N_URL:-https://desilo-n8n.thengd.com}"
API_KEY="${N8N_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "❌ N8N_API_KEY 환경변수 필요"
  exit 1
fi

mkdir -p workflows

# 워크플로우 목록 가져오기
workflows=$(curl -s "$N8N_URL/api/v1/workflows" \
  -H "X-N8N-API-KEY: $API_KEY" | jq -r '.data[].id')

for id in $workflows; do
  name=$(curl -s "$N8N_URL/api/v1/workflows/$id" \
    -H "X-N8N-API-KEY: $API_KEY" | jq -r '.name' | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
  
  echo "Exporting: $name (ID: $id)"
  curl -s "$N8N_URL/api/v1/workflows/$id" \
    -H "X-N8N-API-KEY: $API_KEY" > "workflows/${name}.json"
done

echo "✅ Done!"
