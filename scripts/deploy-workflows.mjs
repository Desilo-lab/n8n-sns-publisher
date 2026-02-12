#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const BASE_URL = (process.env.N8N_BASE_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.N8N_API_KEY || "";
const WORKFLOW_DIR = process.env.N8N_WORKFLOW_DIR || "workflows";

if (!BASE_URL || !API_KEY) {
  console.error("❌ Missing N8N_BASE_URL or N8N_API_KEY");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "X-N8N-API-KEY": API_KEY,
};

async function req(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${url}\n${txt}`);
  }
  return res;
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
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(abs, f));
}

function sanitizeWorkflow(raw) {
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
    const res = await req(
      `${BASE_URL}${prefix}/workflows?limit=${limit}&page=${page}`
    );
    const data = await res.json();
    const items = data.data || data;
    if (!Array.isArray(items) || items.length === 0) break;
    all.push(...items);
    if (items.length < limit) break;
    page += 1;
  }
  return all;
}

async function upsertWorkflow(prefix, wf) {
  const all = await listAllWorkflows(prefix);
  const existing = all.find((x) => x.name === wf.name);
  
  if (!existing) {
    const res = await req(`${BASE_URL}${prefix}/workflows`, {
      method: "POST",
      body: JSON.stringify(wf),
    });
    const created = await res.json();
    console.log(`✅ Created: ${wf.name} (id=${created.id})`);
    return created.id;
  }
  
  await req(`${BASE_URL}${prefix}/workflows/${existing.id}`, {
    method: "PATCH",
    body: JSON.stringify(wf),
  });
  console.log(`🔄 Updated: ${wf.name} (id=${existing.id})`);
  return existing.id;
}

async function setActive(prefix, id, active) {
  try {
    const action = active ? "activate" : "deactivate";
    await req(`${BASE_URL}${prefix}/workflows/${id}/${action}`, { method: "POST" });
    return;
  } catch (_) {
    await req(`${BASE_URL}${prefix}/workflows/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    });
  }
}

async function main() {
  console.log(`🚀 Deploying workflows to ${BASE_URL}`);
  
  const prefix = await detectApiPrefix();
  console.log(`📡 API prefix: ${prefix}`);
  
  const files = loadWorkflowFiles(WORKFLOW_DIR);
  if (files.length === 0) {
    console.log("⚠️  No workflow json files found.");
    return;
  }
  
  console.log(`📂 Found ${files.length} workflow(s)`);
  
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!raw.name) {
      console.warn(`⚠️  Skip ${file}: missing workflow name`);
      continue;
    }
    const wf = sanitizeWorkflow(raw);
    const id = await upsertWorkflow(prefix, wf);
    await setActive(prefix, id, wf.active);
    console.log(`   Active=${wf.active}`);
  }
  
  console.log("✅ Done.");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
