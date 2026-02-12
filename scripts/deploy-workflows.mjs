#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const BASE_URL = (process.env.N8N_BASE_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.N8N_API_KEY || "";
const WORKFLOW_DIR = process.env.N8N_WORKFLOW_DIR || "workflows";
const DRY_RUN = process.env.DRY_RUN === "true" || process.argv.includes("--dry-run");

if (!BASE_URL || !API_KEY) {
  console.error("❌ Missing N8N_BASE_URL or N8N_API_KEY");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "X-N8N-API-KEY": API_KEY,
};

async function req(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}\n${txt}`);
  }
  return res;
}

function loadWorkflowFiles(dir) {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => f.endsWith(".json")).map((f) => ({ file: f, path: path.join(abs, f) }));
}

// n8n API가 허용하는 필드만 추출
function sanitizeForCreate(raw) {
  return {
    name: raw.name,
    nodes: raw.nodes || [],
    connections: raw.connections || {},
    settings: raw.settings || {},
  };
}

function sanitizeForUpdate(raw) {
  return {
    name: raw.name,
    nodes: raw.nodes || [],
    connections: raw.connections || {},
    settings: raw.settings || {},
  };
}

async function listAllWorkflows() {
  const res = await req(`${BASE_URL}/api/v1/workflows?limit=250`);
  const data = await res.json();
  return data.data || [];
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("🚀 n8n Workflow Deployment");
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Mode: ${DRY_RUN ? "🔍 DRY RUN" : "🚀 DEPLOY"}`);
  console.log("");

  const files = loadWorkflowFiles(WORKFLOW_DIR);
  if (files.length === 0) {
    console.log("⚠️  No workflow files found.");
    return;
  }

  const existingList = await listAllWorkflows();
  const existingMap = new Map(existingList.map((w) => [w.name, w]));
  console.log(`📋 Existing: ${existingList.length} | To deploy: ${files.length}\n`);

  let success = 0, failed = 0;

  for (const { file, path: filePath } of files) {
    console.log(`── ${file} ──`);
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (!raw.name) { console.warn("   ⚠️  Skip: no name"); continue; }

      const existing = existingMap.get(raw.name);
      console.log(`   Name: ${raw.name}`);
      console.log(`   Action: ${existing ? `UPDATE (id=${existing.id})` : "CREATE"}`);

      if (DRY_RUN) { console.log("   ✅ [DRY RUN]"); success++; continue; }

      if (!existing) {
        // CREATE
        const body = sanitizeForCreate(raw);
        const res = await req(`${BASE_URL}/api/v1/workflows`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        const created = await res.json();
        console.log(`   ✅ CREATED (id=${created.id})`);
        
        // Activate if needed
        if (raw.active) {
          await req(`${BASE_URL}/api/v1/workflows/${created.id}/activate`, { method: "POST" });
          console.log(`   ✅ ACTIVATED`);
        }
      } else {
        // UPDATE using PUT
        const body = sanitizeForUpdate(raw);
        await req(`${BASE_URL}/api/v1/workflows/${existing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        console.log(`   ✅ UPDATED`);
        
        // Handle activation
        if (raw.active && !existing.active) {
          await req(`${BASE_URL}/api/v1/workflows/${existing.id}/activate`, { method: "POST" });
          console.log(`   ✅ ACTIVATED`);
        } else if (!raw.active && existing.active) {
          await req(`${BASE_URL}/api/v1/workflows/${existing.id}/deactivate`, { method: "POST" });
          console.log(`   ✅ DEACTIVATED`);
        }
      }
      success++;
    } catch (err) {
      console.error(`   ❌ FAILED: ${err.message.split('\n')[0]}`);
      failed++;
    }
    console.log("");
  }

  console.log("═══════════════════════════════════════════");
  console.log(`✅ Success: ${success} | ❌ Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error("❌ Fatal:", e.message); process.exit(1); });
