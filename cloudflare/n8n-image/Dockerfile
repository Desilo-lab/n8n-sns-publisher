# n8n Container Image for Cloudflare Containers
FROM n8nio/n8n:latest

# 환경변수
ENV N8N_PORT=5678
ENV N8N_PROTOCOL=http
ENV GENERIC_TIMEZONE=Asia/Seoul
ENV TZ=Asia/Seoul

# SQLite 사용 (D1과 별개로 n8n 내부용)
ENV DB_TYPE=sqlite
ENV DB_SQLITE_DATABASE=/home/node/.n8n/database.sqlite

# Webhook URL은 Worker에서 처리하므로 내부용
ENV N8N_DISABLE_WEBHOOK_DEREGISTRATION_ON_SHUTDOWN=true

EXPOSE 5678

CMD ["n8n", "start"]
