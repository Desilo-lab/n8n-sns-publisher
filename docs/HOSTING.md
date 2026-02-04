# 호스팅 플랫폼 비교

n8n 같은 상시 실행 Docker 컨테이너용

## 관리형 PaaS

| 플랫폼 | 무료 티어 | 최소 비용 | Docker 지원 | 장점 | 단점 |
|--------|----------|----------|------------|------|------|
| **Render** | ✅ 2 서비스 | $7/월 | ✅ | 무료 티어 관대, 간편 | 스케일링 비쌈 |
| **Railway** | ❌ | $5/월 | ✅ | DX 최고, 빠른 배포 | 비용 예측 어려움 |
| **Fly.io** | ❌ | $5/월 | ✅ | 글로벌 엣지, 빠름 | 설정 복잡 |
| **Koyeb** | ✅ 제한적 | $5.4/월 | ✅ | 심플 | 신생 플랫폼 |

## Self-Hosted (VPS + 오픈소스 PaaS)

| 솔루션 | 설치 | UI | 장점 | 단점 |
|--------|------|-----|------|------|
| **Coolify** | 원클릭 | ✅ 웹 | 예쁨, 활발한 개발 | 리소스 좀 먹음 |
| **Dokku** | CLI | ❌ | 경량, 안정적 | CLI만 |
| **CapRover** | 쉬움 | ✅ 웹 | 클러스터 지원 | UI 올드함 |

### 추천 VPS

| 제공업체 | 최소 비용 | 스펙 | 위치 |
|---------|----------|------|------|
| **Hetzner** | €4.5/월 | 2 vCPU, 4GB | 유럽 |
| **Contabo** | $6/월 | 4 vCPU, 8GB | 유럽/미국 |
| **DigitalOcean** | $6/월 | 1 vCPU, 1GB | 글로벌 |
| **Vultr** | $6/월 | 1 vCPU, 1GB | 글로벌 |

---

## 배포 가이드

### 옵션 1: Render (빠른 시작)

```bash
# 1. render.yaml 생성
cat > render.yaml << 'EOF'
services:
  - type: web
    name: n8n
    env: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: N8N_BASIC_AUTH_USER
        sync: false
      - key: N8N_BASIC_AUTH_PASSWORD
        sync: false
      - key: WEBHOOK_URL
        sync: false
databases:
  - name: n8n-db
    plan: free
EOF

# 2. Render 대시보드에서 Blueprint 연결
```

### 옵션 2: Coolify (가성비)

```bash
# 1. VPS에 Coolify 설치
curl -fsSL https://cdn.coollify.io/install.sh | bash

# 2. 웹 UI 접속 (https://your-ip:8000)

# 3. GitHub 레포 연결 → 자동 배포
```

### 옵션 3: Railway

```bash
# 1. Railway CLI 설치
npm i -g @railway/cli

# 2. 프로젝트 연결
railway login
railway link

# 3. PostgreSQL 추가
railway add postgresql

# 4. 배포
railway up
```

---

## 비용 비교 (n8n 기준, 월)

| 방식 | 비용 | 포함 |
|------|------|------|
| Render 무료 | $0 | 제한적 (슬립 모드) |
| Render 유료 | $7+ | 상시 실행 |
| Railway | $5-15 | 사용량 기반 |
| Hetzner + Coolify | €4.5 | 무제한 앱 |
| DigitalOcean + Dokku | $6 | 무제한 앱 |

**장기적으로 Coolify + VPS가 가장 경제적**
