# n8n SNS 자동 발행 시스템

GitHub에 콘텐츠 푸시 → 자동으로 X, Threads, LinkedIn에 발행

## 🚀 Quick Start

### 방법 1: Docker Compose (로컬/VPS)

```bash
# 1. 환경변수 설정
cp .env.example .env
# .env 파일 편집하여 비밀번호 등 설정

# 2. 실행
docker-compose up -d

# 3. 접속
open http://localhost:5678
```

### 방법 2: Railway 배포 (권장)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.com/new/template?template=https://github.com/Desilo-team/n8n-sns-publisher)

또는 수동 배포:
1. Railway에서 New Project → Deploy from GitHub repo
2. 이 레포 선택
3. PostgreSQL 서비스 추가
4. 환경변수 설정

배포 후 환경변수 설정 (Railway Dashboard → Variables):

```env
# n8n 기본 설정 (템플릿에서 자동 설정됨)
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=<강력한_비밀번호>

# Webhook URL (배포 후 확인)
WEBHOOK_URL=https://<your-app>.up.railway.app
```

### 2. API 키 준비

| 플랫폼 | 필요한 키 | 발급 URL |
|--------|----------|----------|
| X (Twitter) | API Key, API Secret, Access Token, Access Secret | https://developer.twitter.com |
| Threads | App ID, App Secret, Access Token | https://developers.facebook.com |
| LinkedIn | Client ID, Client Secret, Access Token | https://developer.linkedin.com |
| Discord (알림) | Webhook URL | 서버 설정 → 연동 → 웹훅 |

### 3. 워크플로우 Import

1. n8n 대시보드 접속
2. **Workflows** → **Import from File**
3. `workflow.json` 업로드
4. 각 노드에서 Credentials 설정

### 4. GitHub Webhook 설정

Repository → Settings → Webhooks → Add webhook:
- **Payload URL**: `https://<your-n8n>.up.railway.app/webhook/github-content`
- **Content type**: `application/json`
- **Events**: Just the push event

### 5. 테스트

`content/posts/` 디렉토리에 마크다운 파일 푸시:

```markdown
---
title: 테스트 포스트
platforms: [x, threads, linkedin]
---

자동 발행 테스트입니다! 🚀
```

---

## 📁 파일 구조

```
content/posts/
  └── 2024-02-04-test-post.md   # 발행할 콘텐츠
```

### 콘텐츠 포맷

```markdown
---
title: 포스트 제목
platforms: [x, threads, linkedin]  # 발행할 플랫폼 (선택적, 기본: 전체)
image: https://example.com/image.jpg  # 이미지 URL (선택적)
---

본문 내용 (마크다운)

여러 줄 가능
이모지도 OK 🎉
```

---

## 🔧 트러블슈팅

### LinkedIn 403 에러
- LinkedIn API는 승인 프로세스 필요
- 먼저 X + Threads만 테스트 권장

### Webhook 안 받아짐
- Railway 앱 URL 확인
- n8n 워크플로우가 **Active** 상태인지 확인

### Rate Limit
- X: 월 500개 (Free tier)
- Threads: 분당 제한 있음, 간격 두고 발행
