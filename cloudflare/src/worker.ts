/**
 * SNS Auto Publisher - Scale-to-Zero Architecture
 * 
 * 구조:
 * GitHub Webhook → Worker (항상 ON) → Container (n8n, 필요시만)
 *                      ↓
 *                  D1 (로그) / R2 (이미지)
 */

import { Container, getContainer } from "@cloudflare/containers";

// n8n Container 정의
export class N8nContainer extends Container {
  defaultPort = 5678;
  
  // 10분 동안 요청 없으면 sleep (비용 절약)
  sleepAfter = "10m";
  
  // 인스턴스 타입: basic (1GB 메모리)
  instanceType = "basic";
}

interface Env {
  N8N_CONTAINER: DurableObjectNamespace;
  DB: D1Database;
  STORAGE: R2Bucket;
  DISCORD_WEBHOOK_URL: string;
  X_API_KEY: string;
  X_API_SECRET: string;
  X_ACCESS_TOKEN: string;
  X_ACCESS_TOKEN_SECRET: string;
  THREADS_ACCESS_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // GitHub Webhook 엔드포인트
    if (url.pathname === "/webhook/github" && request.method === "POST") {
      return handleGitHubWebhook(request, env, ctx);
    }
    
    // 수동 발행 엔드포인트
    if (url.pathname === "/publish" && request.method === "POST") {
      return handleManualPublish(request, env, ctx);
    }
    
    // n8n UI 접근 (필요시)
    if (url.pathname.startsWith("/n8n")) {
      return proxyToN8n(request, env);
    }
    
    // 상태 확인
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", mode: "scale-to-zero" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    return new Response("SNS Publisher - Scale to Zero", { status: 200 });
  }
};

/**
 * GitHub Webhook 처리
 */
async function handleGitHubWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const payload = await request.json() as any;
  
  // push 이벤트만 처리
  if (!payload.commits) {
    return new Response("Not a push event", { status: 200 });
  }
  
  // content/posts/ 경로의 마크다운 파일 찾기
  const posts: string[] = [];
  for (const commit of payload.commits) {
    const files = [...(commit.added || []), ...(commit.modified || [])];
    for (const file of files) {
      if (file.startsWith("content/posts/") && file.endsWith(".md")) {
        posts.push(file);
      }
    }
  }
  
  if (posts.length === 0) {
    return new Response("No posts to publish", { status: 200 });
  }
  
  // 각 포스트 처리
  const results = [];
  for (const postPath of posts) {
    try {
      // GitHub에서 콘텐츠 가져오기
      const content = await fetchGitHubContent(
        payload.repository.full_name,
        payload.ref.replace("refs/heads/", ""),
        postPath
      );
      
      // 마크다운 파싱
      const parsed = parseMarkdown(content);
      
      // SNS 발행 (Worker에서 직접 - 빠름)
      const publishResults = await publishToSNS(parsed, env);
      
      // 로그 저장
      await saveLog(env.DB, {
        path: postPath,
        title: parsed.title,
        platforms: parsed.platforms,
        results: publishResults,
        publishedAt: new Date().toISOString()
      });
      
      results.push({ path: postPath, success: true, results: publishResults });
      
      // Discord 알림
      await sendDiscordNotification(env.DISCORD_WEBHOOK_URL, {
        title: parsed.title,
        platforms: parsed.platforms,
        results: publishResults
      });
      
    } catch (error: any) {
      results.push({ path: postPath, success: false, error: error.message });
    }
  }
  
  return new Response(JSON.stringify({ processed: results }), {
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * GitHub에서 파일 내용 가져오기
 */
async function fetchGitHubContent(repo: string, branch: string, path: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${url}`);
  return res.text();
}

/**
 * 마크다운 파싱 (프론트매터 + 본문)
 */
interface ParsedContent {
  title: string;
  body: string;
  platforms: string[];
  image?: string;
}

function parseMarkdown(content: string): ParsedContent {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  let meta: Record<string, any> = {};
  let body = content;
  
  if (match) {
    const yamlStr = match[1];
    body = match[2].trim();
    
    // 간단한 YAML 파싱
    yamlStr.split("\n").forEach(line => {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        let value: any = line.slice(colonIdx + 1).trim();
        
        // 배열 처리 [x, threads, linkedin]
        if (value.startsWith("[") && value.endsWith("]")) {
          value = value.slice(1, -1).split(",").map((s: string) => s.trim());
        }
        meta[key] = value;
      }
    });
  }
  
  return {
    title: meta.title || "Untitled",
    body,
    platforms: meta.platforms || ["x", "threads"],
    image: meta.image
  };
}

/**
 * SNS에 발행
 */
async function publishToSNS(content: ParsedContent, env: Env): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  
  // X (Twitter) 발행
  if (content.platforms.includes("x")) {
    try {
      const xText = content.body.length > 270 
        ? content.body.substring(0, 267) + "..." 
        : content.body;
      results.x = await postToX(xText, env);
    } catch (e: any) {
      results.x = { error: e.message };
    }
  }
  
  // Threads 발행
  if (content.platforms.includes("threads")) {
    try {
      const threadsText = content.body.length > 500
        ? content.body.substring(0, 497) + "..."
        : content.body;
      results.threads = await postToThreads(threadsText, env);
    } catch (e: any) {
      results.threads = { error: e.message };
    }
  }
  
  return results;
}

/**
 * X (Twitter) API v2 포스팅
 */
async function postToX(text: string, env: Env): Promise<any> {
  // OAuth 1.0a 서명 필요 - 간단히 Bearer 토큰 사용
  const response = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.X_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });
  
  if (!response.ok) {
    throw new Error(`X API error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Threads API 포스팅
 */
async function postToThreads(text: string, env: Env): Promise<any> {
  // Step 1: Create container
  const createRes = await fetch(
    `https://graph.threads.net/v1.0/me/threads?media_type=TEXT&text=${encodeURIComponent(text)}&access_token=${env.THREADS_ACCESS_TOKEN}`,
    { method: "POST" }
  );
  
  if (!createRes.ok) {
    throw new Error(`Threads create error: ${createRes.status}`);
  }
  
  const { id: creationId } = await createRes.json() as any;
  
  // Step 2: Publish
  const publishRes = await fetch(
    `https://graph.threads.net/v1.0/me/threads_publish?creation_id=${creationId}&access_token=${env.THREADS_ACCESS_TOKEN}`,
    { method: "POST" }
  );
  
  if (!publishRes.ok) {
    throw new Error(`Threads publish error: ${publishRes.status}`);
  }
  
  return publishRes.json();
}

/**
 * D1에 로그 저장
 */
async function saveLog(db: D1Database, log: any): Promise<void> {
  await db.prepare(
    "INSERT INTO publish_logs (path, title, platforms, results, published_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(
    log.path,
    log.title,
    JSON.stringify(log.platforms),
    JSON.stringify(log.results),
    log.publishedAt
  ).run();
}

/**
 * Discord 알림
 */
async function sendDiscordNotification(webhookUrl: string, data: any): Promise<void> {
  if (!webhookUrl) return;
  
  const platformStatus = Object.entries(data.results)
    .map(([platform, result]: [string, any]) => 
      `${platform}: ${result.error ? "❌" : "✅"}`
    )
    .join(" | ");
  
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: "📢 SNS 자동 발행",
        description: data.title,
        color: 5763719,
        fields: [
          { name: "플랫폼", value: platformStatus }
        ],
        timestamp: new Date().toISOString()
      }]
    })
  });
}

/**
 * n8n Container로 프록시 (복잡한 워크플로우용)
 */
async function proxyToN8n(request: Request, env: Env): Promise<Response> {
  const container = getContainer(env.N8N_CONTAINER, "main");
  
  // Container 깨우기 + 요청 전달
  const newUrl = new URL(request.url);
  newUrl.pathname = newUrl.pathname.replace("/n8n", "");
  
  return container.fetch(new Request(newUrl.toString(), request));
}

/**
 * 수동 발행 처리
 */
async function handleManualPublish(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const { content, platforms } = await request.json() as any;
  
  const parsed: ParsedContent = {
    title: "Manual Post",
    body: content,
    platforms: platforms || ["x", "threads"]
  };
  
  const results = await publishToSNS(parsed, env);
  
  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" }
  });
}
