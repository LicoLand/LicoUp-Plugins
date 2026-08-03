#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const MAX_OUTPUT_BYTES = 1024 * 1024;
const EXPECTED_TOOLS = [
  "lico_subagent_cancel",
  "lico_subagent_continue",
  "lico_subagent_delegate",
  "lico_subagent_probe",
  "lico_subagents_list",
];

const launcher = fileURLToPath(new URL("./start.mjs", import.meta.url));
const child = spawn(process.execPath, [launcher], {
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

let stdout = "";
let stderrBytes = 0;
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdout += chunk;
  if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) child.kill("SIGTERM");
});
child.stderr.on("data", (chunk) => {
  stderrBytes += chunk.length;
  if (stderrBytes > MAX_OUTPUT_BYTES) child.kill("SIGTERM");
});

child.stdin.end([
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "codex", version: "1" },
    },
  }),
  JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
  "",
].join("\n"));

const timeout = setTimeout(() => child.kill("SIGTERM"), 30_000);
const [code] = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", (...result) => resolve(result));
});
clearTimeout(timeout);

assert.equal(code, 0, "MCP launcher failed");
const frames = stdout
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
assert.equal(
  frames.find((frame) => frame.id === 1)?.result?.protocolVersion,
  "2025-06-18",
);
const tools = frames
  .find((frame) => frame.id === 2)
  ?.result?.tools?.map((tool) => tool.name)
  .sort();
assert.deepEqual(tools, EXPECTED_TOOLS);
console.log(`MCP smoke passed (${EXPECTED_TOOLS.length} tools)`);
