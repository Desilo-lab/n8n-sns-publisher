#!/usr/bin/env node
/**
 * n8n Workflow Deployment Script
 * - Upsert (create or update) workflows via n8n API
 * - DRY_RUN support for preview
 * - Retry on 429/5xx errors
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ============ Config ============
const BASE_URL = (process.env.N8N_BASE_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.N8N_API_KEY || "";
const WORKFLOW_DIR = process.env.N8N_WORKFLOW_DIR || "workflows";
const DRY_RUN = process.env.DRY_RUN === "true" || process.argv.includes("--dry-run");
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// ============ Validation ============
if (!BASE_URL || !API_KEY) {
  console.error("❌ Missing required environment variables:");
  if (!BASE_URL) console.error("   - N8N_BASE_URL");
  if (!API_KEY) console.error("   - N8N_API_KEY");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "X-N8N-API-KEY": API_KEY,
};

// ============ Helpers ============
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function req(url, init = {}, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { ...headers, ...(init.headers || {}) },
      });

      // Retry on rate limit or server error
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const delay = RETRY_DELAY_MS * attempt;
        console.warn(`   ⚠️  ${res.status} - Retry ${attempt}/${retries} in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}\n${txt}`);
      }
      return res;
    } catch (err) {
      if (attempt < retries && err.code === "ECONNRESET") {
        console.warn(`   ⚠️  Connection reset - Retry ${attempt}/${retries}...`);
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw err;
    }
  }
}

async function detectApiPrefix() {
  const candidates = ["/api/v1", "/rest"];
  for (const prefix of candidates) {
    try {
      await req(`${BASE_URL}${prefix}/workflows?limit=1`);
      return prefix;
    } catch (_) {}
  }
  throw new Error("Could not detect n8n API prefix (/api/v1 or /rest)");
}

function loadWorkflowFiles(dir) {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) {
    console.warn(`⚠️  Directory not found: ${abs}`);
    return [];
  }
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: f, path: path.join(abs, f) }));
}

function sanitizeWorkflow(raw) {
  // Remove server-managed metadata
  const {
    id,
    createdAt,
    updatedAt,
    versionId,
    triggerCount,
    staticData,
    ...rest
  } = raw;
  return {
    name: rest.name,
    nodes: rest.nodes || [],
    connections: rest.connections || {},
    settings: rest.settings || {},
    active: Boolean(rest.active),
    pinData: rest.pinData || {},
  };
}

async function listAllWorkflows(prefix) {
  let page = 1;
  const limit = 250;
  const all = [];
  while (true) {
    const res = await req(`${BASE_URL}${prefix}/workflows?limit=${limit}&page=${page}`);
    const data = await res.json();
    const items = data.data || data;
    if (!Array.isArray(items) || items.length === 0) break;
    all.push(...items);
    if (items.length < limit) break;
    page += 1;
  }
  return all;
}

async function upsertWorkflow(prefix, wf, existingMap) {
  const existing = existingMap.get(wf.name);

  if (!existing) {
    // CREATE
    const res = await req(`${BASE_URL}${prefix}/workflows`, {
      method: "POST",
      body: JSON.stringify(wf),
    });
    const created = await res.json();
    return { action: "created", id: created.id };
  }

  // UPDATE
  await req(`${BASE_URL}${prefix}/workflows/${existing.id}`, {
    method: "PATCH",
    body: JSON.stringify(wf),
  });
  return { action: "updated", id: existing.id };
}

async function setActive(prefix, id, active) {
  try {
    const action = active ? "activate" : "deactivate";
    await req(`${BASE_URL}${prefix}/workflows/${id}/${action}`, { method: "POST" });
  } catch (_) {
    // Fallback for older versions
    await req(`${BASE_URL}${prefix}/workflows/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    });
  }
}

// ============ Main ============
async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("🚀 n8n Workflow Deployment");
  console.log("═══════════════════════════════════════════");
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Workflow Dir: ${WORKFLOW_DIR}`);
  console.log(`   Mode: ${DRY_RUN ? "🔍 DRY RUN (no changes)" : "🚀 DEPLOY"}`);
  console.log("");

  const prefix = await detectApiPrefix();
  console.log(`📡 API prefix detected: ${prefix}`);

  const files = loadWorkflowFiles(WORKFLOW_DIR);
  if (files.length === 0) {
    console.log("⚠️  No workflow JSON files found.");
    return;
  }
  console.log(`📂 Found ${files.length} workflow file(s)\n`);

  // Load existing workflows for upsert comparison
  const existingList = await listAllWorkflows(prefix);
  const existingMap = new Map(existingList.map((w) => [w.name, w]));
  console.log(`📋 Existing workflows in n8n: ${existingList.length}\n`);

  const results = { success: [], failed: [] };

  for (const { file, path: filePath } of files) {
    console.log(`── ${file} ──`);
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (!raw.name) {
        console.warn(`   ⚠️  Skip: missing workflow name`);
        results.failed.push({ file, error: "missing name" });
        continue;
      }

      const wf = sanitizeWorkflow(raw);
      const existing = existingMap.get(wf.name);
      const action = existing ? "UPDATE" : "CREATE";

      console.log(`   Name: ${wf.name}`);
      console.log(`   Action: ${action}${existing ? ` (id=${existing.id})` : ""}`);
      console.log(`   Active: ${wf.active}`);

      if (DRY_RUN) {
        console.log(`   ✅ [DRY RUN] Would ${action.toLowerCase()}`);
        results.success.push({ file, name: wf.name, action: `dry-run-${action.toLowerCase()}` });
        continue;
      }

      const { action: resultAction, id } = await upsertWorkflow(prefix, wf, existingMap);
      await setActive(prefix, id, wf.active);
      console.log(`   ✅ ${resultAction.toUpperCase()} (id=${id})`);
      results.success.push({ file, name: wf.name, id, action: resultAction });
    } catch (err) {
      console.error(`   ❌ FAILED: ${err.message}`);
      results.failed.push({ file, error: err.message });
    }
    console.log("");
  }

  // Summary
  console.log("═══════════════════════════════════════════");
  console.log("📊 Summary");
  console.log("═══════════════════════════════════════════");
  console.log(`   ✅ Success: ${results.success.length}`);
  console.log(`   ❌ Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log("\n❌ Failed files:");
    results.failed.forEach((f) => console.log(`   - ${f.file}: ${f.error}`));
    process.exit(1);
  }

  console.log("\n✅ Done.");
}

main().catch((e) => {
  console.error("❌ Fatal error:", e);
  process.exit(1);
});
