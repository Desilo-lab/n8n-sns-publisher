FROM n8nio/n8n:latest

# 타임존 설정
ENV GENERIC_TIMEZONE=Asia/Seoul
ENV TZ=Asia/Seoul

# n8n 기본 설정
ENV N8N_PORT=5678
ENV N8N_PROTOCOL=https

# Railway에서 PORT 환경변수 사용
ENV PORT=5678

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:5678/healthz || exit 1

EXPOSE 5678

CMD ["n8n", "start"]
