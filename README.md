# n8n SNS Publisher

n8n 기반 SNS 자동 발행 시스템 + Desilo repository_dispatch 연동

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  This Repo      │────▶│   n8n Server    │────▶│  Desilo Repo    │
│  (workflows/)   │     │  (Docker)       │     │  (dispatch)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   GitHub Actions          Cloudflare Tunnel      content-pack.yml
   (auto deploy)         desilo-n8n.thengd.com    (n8n-content-generate)
```

## 📁 Project Structure

```
n8n-sns-publisher/
├── docker-compose.yml              # n8n + PostgreSQL
├── .env.example                    # Environment template
├── workflows/
│   ├── desilo-content-pack-trigger.json  # ⭐ Desilo dispatch workflow
│   └── test-tweet.json                   # Test workflow
├── scripts/
│   └── deploy-workflows.mjs        # API deployment script
└── .github/workflows/
    └── n8n-deploy.yml              # Auto-deploy on push
```

## 🚀 Setup

### 1. Local Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
vim .env

# Start containers
docker compose up -d

# Import workflows (first time only)
docker compose --profile init run --rm n8n-init
```

### 2. GitHub Secrets (for auto-deploy)

Add to `Desilo-lab/n8n-sns-publisher` → Settings → Secrets:

| Secret | Value |
|--------|-------|
| `N8N_BASE_URL` | `https://desilo-n8n.thengd.com` |
| `N8N_API_KEY` | (generate at n8n Settings → API) |

### 3. n8n Credentials

In n8n UI, create credential:
- **Name**: `GitHub Dispatch Token`
- **Type**: Header Auth
- **Header Name**: `Authorization`
- **Header Value**: `token <DESILO_DISPATCH_TOKEN>`

---

## 📤 Deployment

### Auto Deploy (GitHub Actions)

Push changes to `workflows/*.json` → GitHub Actions deploys automatically.

### Manual Deploy

```bash
# Set environment
export N8N_BASE_URL=https://desilo-n8n.thengd.com
export N8N_API_KEY=your-api-key

# Dry run (preview only)
DRY_RUN=true node scripts/deploy-workflows.mjs

# Deploy
node scripts/deploy-workflows.mjs
```

---

## 🧪 Trigger Testing

### Desilo Contract (content-pack.yml)

The n8n workflow must send `repository_dispatch` with this exact format:

```json
{
  "event_type": "n8n-content-generate",
  "client_payload": {
    "hypothesis_path": "01-hypotheses/2026-02-02-issue-15",
    "channels": "linkedin,x,threads",
    "include_image": true,
    "allow_statuses": "validated,partial",
    "overwrite": false
  }
}
```

**Rules:**
- `event_type`: Must be `n8n-content-generate`
- `hypothesis_path`: Must start with `01-hypotheses/`
- `channels`: Comma-separated (linkedin, x, threads, instagram)
- `allow_statuses`: validated, partial, or both
- `overwrite`: false to skip existing, true to regenerate

### Test via Webhook

```bash
curl -X POST https://desilo-n8n.thengd.com/webhook/desilo-content-pack \
  -H "Content-Type: application/json" \
  -d '{
    "hypothesis_path": "01-hypotheses/2026-02-02-issue-15",
    "channels": "linkedin,threads",
    "include_image": true,
    "allow_statuses": "validated,partial",
    "overwrite": false
  }'
```

**Expected Response (Success):**
```json
{
  "success": true,
  "dispatched": true,
  "event_type": "n8n-content-generate",
  "hypothesis_path": "01-hypotheses/2026-02-02-issue-15",
  "timestamp": "2026-02-12T12:00:00.000Z"
}
```

**Expected Response (Invalid Path):**
```json
{
  "success": false,
  "error": "Invalid hypothesis_path format. Must start with 01-hypotheses/",
  "received": "invalid/path"
}
```

### Verify in Desilo

After trigger, check:
1. Desilo repo → Actions tab
2. Look for "Content Pack Generator" workflow run
3. Triggered by: `repository_dispatch (n8n-content-generate)`

---

## 🔧 Environment Variables

### Required for n8n Server

| Variable | Description | Example |
|----------|-------------|---------|
| `DESILO_DISPATCH_TOKEN` | GitHub token for dispatch | `ghp_xxxx` |
| `DESILO_OWNER` | Target repo owner | `Desilo-team` |
| `DESILO_REPO` | Target repo name | `desilo` |
| `DESILO_EVENT_TYPE` | Dispatch event type | `n8n-content-generate` |
| `DESILO_API_VERSION` | GitHub API version | `2022-11-28` |

### Required for Deployment

| Variable | Description |
|----------|-------------|
| `N8N_BASE_URL` | n8n server URL |
| `N8N_API_KEY` | n8n API key |

---

## 📊 Supported Platforms

| Platform | API Cost | Status |
|----------|----------|--------|
| X (Twitter) | $100/month | ❌ Not supported (cost) |
| Threads | Free | 🔄 Requires Meta account |
| LinkedIn | Free | 🔄 Planned |
| Bluesky | Free | 🔄 Planned |

---

## 📜 License

MIT
