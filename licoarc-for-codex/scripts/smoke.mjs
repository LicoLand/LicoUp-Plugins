#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = path.join(root, "mcp", "server.mjs");

const child = spawn(process.execPath, [serverPath], {
  cwd: root,
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, LICOARC_SUBAGENT_MODE: "stub" },
});

const rl = readline.createInterface({ input: child.stdout });
let nextId = 0;

function send(method, params) {
  const id = ++nextId;
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return id;
}

function read() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for MCP response")), 10_000);
    rl.once("line", (line) => {
      clearTimeout(timer);
      resolve(JSON.parse(line));
    });
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "licoarc-smoke", version: "0.1.0" },
  });
  const init = await read();
  assert(init.result?.serverInfo?.name === "licoarc-subagent", "initialize failed");

  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
  );

  send("tools/list", {});
  const listed = await read();
  const names = (listed.result?.tools || []).map((t) => t.name).sort();
  assert(
    JSON.stringify(names) ===
      JSON.stringify([
        "await_subagent",
        "cancel_subagent",
        "get_subagent_status",
        "spawn_subagent",
      ]),
    `unexpected tools: ${names.join(",")}`,
  );

  send("tools/call", {
    name: "spawn_subagent",
    arguments: { prompt: "Return a one-line hello." },
  });
  const spawned = await read();
  const spawnPayload = JSON.parse(spawned.result.content[0].text);
  assert(spawnPayload.job_id, "spawn missing job_id");

  send("tools/call", {
    name: "await_subagent",
    arguments: { job_id: spawnPayload.job_id, timeout_ms: 5000 },
  });
  const awaited = await read();
  const awaitPayload = JSON.parse(awaited.result.content[0].text);
  assert(awaitPayload.status === "completed", `expected completed, got ${awaitPayload.status}`);
  assert(typeof awaitPayload.output === "string" && awaitPayload.output.length > 0, "missing output");

  console.log(
    JSON.stringify(
      {
        ok: true,
        tools: names,
        mode: awaitPayload.mode,
        status: awaitPayload.status,
      },
      null,
      2,
    ),
  );
  child.kill("SIGTERM");
  process.exit(0);
} catch (error) {
  console.error(error?.message || error);
  child.kill("SIGTERM");
  process.exit(1);
}
