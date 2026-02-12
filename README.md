# n8n SNS Publisher

n8n 기반 SNS 자동 발행 시스템

## 🏗️ 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  GitHub Repo    │────▶│   n8n Server    │────▶│  Desilo Repo    │
│  (workflows/)   │     │  (Docker)       │     │  (dispatch)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        ▼                       ▼
   GitHub Actions          Cloudflare Tunnel
   (auto deploy)           (desilo-n8n.thengd.com)
```

## 📁 프로젝트 구조

```
n8n-sns-publisher/
├── docker-compose.yml        # n8n + PostgreSQL
├── .env.example              # 환경변수 템플릿
├── workflows/                # n8n 워크플로우 JSON
│   ├── test-tweet.json
│   └── desilo-content-pack-trigger.json
├── scripts/
│   ├── deploy-workflows.mjs  # API 배포 스크립트
│   ├── export-all.sh         # 워크플로우 export
│   └── import-workflow.sh    # 워크플로우 import
└── .github/workflows/
    └── n8n-deploy.yml        # 자동 배포 액션
```

## 🚀 설정 방법

### 1. 로컬 환경

```bash
# 환경변수 설정
cp .env.example .env
# .env 파일 수정

# 컨테이너 시작
docker compose up -d

# 초기 워크플로우 import (최초 1회)
docker compose run --rm n8n-init
```

### 2. GitHub Secrets 설정

이 repo의 Settings → Secrets에 추가:

| Secret | 설명 |
|--------|------|
| `N8N_BASE_URL` | `https://desilo-n8n.thengd.com` |
| `N8N_API_KEY` | n8n API 키 |

### 3. n8n 서버 환경변수

docker-compose.yml 또는 .env에 추가:

| 변수 | 설명 |
|------|------|
| `DESILO_DISPATCH_TOKEN` | Desilo repo dispatch 권한 토큰 |

## 📝 워크플로우 관리

### 새 워크플로우 추가

1. n8n UI에서 워크플로우 생성
2. Export → JSON 다운로드
3. `workflows/` 디렉토리에 저장
4. Git commit & push
5. GitHub Actions가 자동 배포

### 수동 배포

```bash
export N8N_BASE_URL=https://desilo-n8n.thengd.com
export N8N_API_KEY=your-api-key
node scripts/deploy-workflows.mjs
```

## 🔗 Cross-repo Integration

### Desilo → n8n (Webhook)

```bash
curl -X POST https://desilo-n8n.thengd.com/webhook/desilo-content-pack \
  -H "Content-Type: application/json" \
  -d '{
    "hypothesis_path": "01-hypotheses/2026-02-12-issue-16",
    "channels": "linkedin,threads",
    "include_image": true
  }'
```

### n8n → Desilo (Repository Dispatch)

n8n 워크플로우에서 GitHub API로 dispatch 이벤트 전송:
- Event type: `n8n-content-generate`
- Desilo의 `.github/workflows/content-pack.yml`이 트리거됨

## 📊 지원 플랫폼

| 플랫폼 | API 비용 | 상태 |
|--------|----------|------|
| X (Twitter) | $100/월 | ❌ 미지원 (비용) |
| Threads | 무료 | 🔄 설정 중 |
| LinkedIn | 무료 | 🔄 예정 |
| Bluesky | 무료 | 🔄 예정 |

## 📜 라이선스

MIT
