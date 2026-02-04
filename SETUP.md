# n8n Credentials 설정 가이드

워크플로우 import 후, 각 플랫폼 Credentials를 설정해야 합니다.

---

## 1️⃣ X (Twitter) API

### Developer Portal 설정

1. https://developer.twitter.com 접속
2. Projects & Apps → 새 프로젝트 생성
3. **User authentication settings**:
   - App permissions: **Read and write**
   - Type of App: **Web App**
   - Callback URL: `https://<your-n8n>.up.railway.app/rest/oauth2-credential/callback`

### 필요한 키

| 키 | 위치 |
|----|------|
| API Key | Keys and tokens → Consumer Keys |
| API Secret | Keys and tokens → Consumer Keys |
| Access Token | Keys and tokens → Authentication Tokens |
| Access Token Secret | Keys and tokens → Authentication Tokens |

### n8n Credential 생성

1. n8n → **Credentials** → **New**
2. Type: **Twitter OAuth2 API**
3. 위 4개 키 입력

---

## 2️⃣ Threads API (Meta)

### Meta Developer 설정

1. https://developers.facebook.com 접속
2. **My Apps** → **Create App**
3. App Type: **Business**
4. Products → **Threads API** 추가

### 권한 설정

필요한 권한:
- `threads_basic`
- `threads_content_publish`

### Access Token 발급

1. App Dashboard → **Threads API** → **Get Access Token**
2. 본인 계정으로 로그인하여 권한 승인
3. Long-lived token으로 교환 권장 (60일 유효)

### n8n Credential 생성

1. n8n → **Credentials** → **New**
2. Type: **Generic OAuth2 API**
3. 설정:
   - **Authorization URL**: `https://threads.net/oauth/authorize`
   - **Access Token URL**: `https://graph.threads.net/oauth/access_token`
   - **Client ID**: App ID
   - **Client Secret**: App Secret
   - **Scope**: `threads_basic,threads_content_publish`

---

## 3️⃣ LinkedIn API

### ⚠️ 주의: LinkedIn은 승인 프로세스가 까다롭습니다

### Developer Portal 설정

1. https://developer.linkedin.com 접속
2. **My Apps** → **Create App**
3. Company Page 연결 필요 (없으면 생성)

### 권한 요청

**Products** 탭에서 추가:
- **Share on LinkedIn** (개인 포스팅용)
- **Marketing Developer Platform** (Company Page용, 승인 필요)

### Access Token

1. OAuth 2.0 Tools로 테스트 토큰 발급
2. Scope: `w_member_social`

### Person URN 확인

```bash
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://api.linkedin.com/v2/me"
```

응답의 `id` 값을 workflow.json의 `REPLACE_WITH_PERSON_URN`에 입력

### n8n Credential 생성

1. Type: **Generic OAuth2 API**
2. 설정:
   - **Authorization URL**: `https://www.linkedin.com/oauth/v2/authorization`
   - **Access Token URL**: `https://www.linkedin.com/oauth/v2/accessToken`
   - **Client ID**: Client ID
   - **Client Secret**: Client Secret
   - **Scope**: `w_member_social`

---

## 4️⃣ Discord Webhook (알림용)

### Webhook URL 생성

1. Discord 서버 → 채널 설정 → **연동**
2. **웹훅** → **새 웹훅**
3. URL 복사

### n8n 환경변수 설정

Railway Dashboard → Variables:

```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

---

## 5️⃣ GitHub Webhook

### 설정

Repository → Settings → Webhooks → Add webhook:

| 필드 | 값 |
|------|-----|
| Payload URL | `https://<your-n8n>.up.railway.app/webhook/github-content` |
| Content type | `application/json` |
| Secret | (선택사항) |
| Events | Just the push event |

---

## ✅ 체크리스트

- [ ] Railway에 n8n 배포 완료
- [ ] X API Credentials 설정
- [ ] Threads API Credentials 설정
- [ ] LinkedIn API Credentials 설정 (선택)
- [ ] Discord Webhook URL 환경변수 설정
- [ ] GitHub Webhook 설정
- [ ] 워크플로우 Active 상태로 변경

---

## 🧪 테스트

1. `content/posts/test-post.md` 파일 생성 & 푸시
2. n8n 실행 로그 확인
3. 각 SNS에서 포스트 확인
4. Discord 알림 확인
