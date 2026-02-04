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

## 배포 (GitHub Actions 자동화)

### 1. GitHub Secrets 설정

Repository → Settings → Secrets and variables → Actions → **New repository secret**

#### 필수

| Secret | 설명 | 발급 방법 |
|--------|------|----------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 토큰 | [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) → Create Token → **Edit Cloudflare Workers** 템플릿 사용 |

#### X (Twitter) API

| Secret | 설명 | 발급 방법 |
|--------|------|----------|
| `X_API_KEY` | Consumer Key | [X Developer Portal](https://developer.twitter.com) → Project → Keys and tokens |
| `X_API_SECRET` | Consumer Secret | 위와 동일 |
| `X_ACCESS_TOKEN` | Access Token | 위와 동일 (User authentication) |
| `X_ACCESS_TOKEN_SECRET` | Access Token Secret | 위와 동일 |

#### Threads API

| Secret | 설명 | 발급 방법 |
|--------|------|----------|
| `THREADS_ACCESS_TOKEN` | Long-lived Access Token | [Meta Developer](https://developers.facebook.com) → 앱 생성 → Threads API → Access Token 발급 |

#### 알림 (선택)

| Secret | 설명 | 발급 방법 |
|--------|------|----------|
| `DISCORD_WEBHOOK_URL` | Discord Webhook | 서버 → 채널 설정 → 연동 → 웹훅 → URL 복사 |

---

### API 토큰 발급 가이드

#### Cloudflare API Token
1. https://dash.cloudflare.com/profile/api-tokens
2. **Create Token**
3. **Edit Cloudflare Workers** 템플릿 선택
4. Account Resources: 본인 계정 선택
5. Zone Resources: All zones (또는 특정 도메인)
6. **Continue to summary** → **Create Token**
7. 토큰 복사 (한 번만 보임!)

#### X (Twitter) API
1. https://developer.twitter.com 접속
2. Developer Portal → Projects & Apps → 새 프로젝트
3. App permissions: **Read and write**
4. Keys and tokens 탭:
   - Consumer Keys → API Key & Secret
   - Authentication Tokens → Access Token & Secret

#### Threads API
1. https://developers.facebook.com 접속
2. My Apps → Create App → Business 타입
3. Products → **Threads API** 추가
4. 권한: `threads_basic`, `threads_content_publish`
5. Access Token 발급 (60일 유효, 갱신 필요)

### 2. 초기 설정 (1회)

Actions → **Initial Setup** → Run workflow

이 워크플로우가:
- D1 데이터베이스 생성
- R2 버킷 생성
- 스키마 적용

### 3. D1 ID 업데이트

1. Cloudflare Dashboard → D1 → sns-publisher-db
2. database_id 복사
3. `cloudflare/wrangler.jsonc` 업데이트
4. 커밋 & 푸시

### 4. 자동 배포

`cloudflare/` 폴더 변경 시 자동으로:
- Secrets 설정
- Worker 배포
- Container 이미지 빌드 & 푸시

---

## 수동 배포 (로컬)

```bash
# Wrangler 설치 & 로그인
npm install -g wrangler
wrangler login

# 배포
cd cloudflare
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
