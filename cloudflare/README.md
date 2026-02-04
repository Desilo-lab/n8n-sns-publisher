# Cloudflare Containers - Scale to Zero 배포

## 구조

```
GitHub Webhook
      ↓
┌─────────────────────────────────┐
│  Worker (항상 ON, 거의 무료)     │
│  - Webhook 수신                 │
│  - 마크다운 파싱                │
│  - SNS API 직접 호출            │
│  - D1에 로그 저장               │
└─────────────────────────────────┘
      ↓ (복잡한 워크플로우 필요시)
┌─────────────────────────────────┐
│  Container (n8n, 필요시만)       │
│  - 10분 후 자동 sleep           │
│  - 멀티미디어 생성 등           │
└─────────────────────────────────┘
```

## 비용

| 구성요소 | 예상 비용 |
|---------|----------|
| Workers Paid | $5/월 |
| Container (scale-to-zero) | ~$0-1/월 |
| D1 | 무료 (5GB) |
| R2 | 무료 (10GB) |
| **총** | **~$5/월** |

## 배포

### 1. 사전 준비

```bash
# Wrangler 설치
npm install -g wrangler

# 로그인
wrangler login
```

### 2. D1 데이터베이스 생성

```bash
# 데이터베이스 생성
wrangler d1 create sns-publisher-db

# 출력된 database_id를 wrangler.jsonc에 입력

# 스키마 적용
wrangler d1 execute sns-publisher-db --file=schema.sql
```

### 3. R2 버킷 생성

```bash
wrangler r2 bucket create sns-publisher-assets
```

### 4. Secrets 설정

```bash
# X (Twitter) API
wrangler secret put X_API_KEY
wrangler secret put X_API_SECRET
wrangler secret put X_ACCESS_TOKEN
wrangler secret put X_ACCESS_TOKEN_SECRET

# Threads
wrangler secret put THREADS_ACCESS_TOKEN

# Discord (선택)
wrangler secret put DISCORD_WEBHOOK_URL
```

### 5. Container 이미지 빌드 & 푸시

```bash
# 이미지 빌드
wrangler containers build ./n8n-image

# 푸시
wrangler containers push
```

### 6. 배포

```bash
wrangler deploy
```

### 7. GitHub Webhook 설정

Repository → Settings → Webhooks → Add webhook:

| 필드 | 값 |
|-----|-----|
| Payload URL | `https://sns-publisher.<your-subdomain>.workers.dev/webhook/github` |
| Content type | `application/json` |
| Events | Just the push event |

## 테스트

### 수동 발행

```bash
curl -X POST https://sns-publisher.<your-subdomain>.workers.dev/publish \
  -H "Content-Type: application/json" \
  -d '{"content": "테스트 포스트입니다!", "platforms": ["x", "threads"]}'
```

### 상태 확인

```bash
curl https://sns-publisher.<your-subdomain>.workers.dev/health
```

## 파일 구조

```
cloudflare/
├── wrangler.jsonc      # Wrangler 설정
├── src/
│   └── worker.ts       # Worker 코드
├── schema.sql          # D1 스키마
├── n8n-image/
│   └── Dockerfile      # n8n Container 이미지
└── README.md           # 이 파일
```

## n8n UI 접근 (선택)

복잡한 워크플로우가 필요할 때:

```
https://sns-publisher.<your-subdomain>.workers.dev/n8n
```

※ Container가 깨어나면서 약간의 cold start 있음 (2-3초)
