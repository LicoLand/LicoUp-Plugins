#!/usr/bin/env node
/**
 * Smoke the MCP → command path without a real provider API key.
 * Uses LICOARC_PROVIDER_CHAT_COMMAND to return a fixed JSON payload.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = path.join(root, "mcp", "server.mjs");

const child = spawn(process.execPath, [serverPath], {
  cwd: root,
  stdio: ["pipe", "pipe", "inherit"],
  env: {
    ...process.env,
    LICOARC_SUBAGENT_MODE: "",
    LICOARC_PROVIDER_CHAT_COMMAND:
      'printf "%s\\n" "{\\"ok\\":true,\\"output\\":\\"live-command-wired\\"}"',
  },
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
    const timer = setTimeout(
      () => reject(new Error("timeout waiting for MCP response")),
      10_000,
    );
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
    clientInfo: { name: "licoarc-smoke-live-command", version: "0.1.0" },
  });
  await read();
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
  );

  send("tools/call", {
    name: "spawn_subagent",
    arguments: { prompt: "ping" },
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
  assert(awaitPayload.mode === "custom-command", `expected custom-command mode, got ${awaitPayload.mode}`);
  assert(
    awaitPayload.output === "live-command-wired",
    `unexpected output: ${awaitPayload.output}`,
  );
  console.log("smoke-live-command ok");
  child.kill();
  process.exit(0);
} catch (error) {
  console.error(error?.message || error);
  child.kill();
  process.exit(1);
}
