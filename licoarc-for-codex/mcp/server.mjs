#!/usr/bin/env node
/**
 * Lico Arc sub-agent MCP server (stdio).
 *
 * Progress model: async in-memory jobs + poll/await tools.
 * Does not modify Codex model provider / base_url / config.toml.
 *
 * Live forwarding path (best-effort):
 *   1. LICOARC_PROVIDER_CHAT_COMMAND — custom shell template with {provider} {model} {text}
 *   2. `lico-client provider-chat` — model-forwarding CLI over provider_chat
 *   3. `lico-client forward --profile <provider>` — existing profile forward fallback
 *
 * Set LICOARC_SUBAGENT_MODE=stub to force local stub completions for install smoke tests.
 */

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import readline from "node:readline";

const SERVER_NAME = "licoarc-subagent";
const SERVER_VERSION = "0.1.0";
const DEFAULT_PROVIDER = "deepseek";
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_AWAIT_MS = 120_000;
const MAX_AWAIT_MS = 600_000;
const POLL_SLICE_MS = 250;

/** @typedef {"queued"|"running"|"completed"|"failed"|"cancelled"} JobStatus */

/**
 * @typedef {object} Job
 * @property {string} jobId
 * @property {JobStatus} status
 * @property {string} provider
 * @property {string} model
 * @property {string} prompt
 * @property {string} [system]
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number} [startedAt]
 * @property {number} [completedAt]
 * @property {number} progress
 * @property {string} stage
 * @property {string} [output]
 * @property {string} [error]
 * @property {string} [mode]
 * @property {boolean} cancelRequested
 * @property {AbortController} [controller]
 */

/** @type {Map<string, Job>} */
const jobs = new Map();

const TOOLS = [
  {
    name: "spawn_subagent",
    description:
      "Start an async Lico Arc sub-agent job. Defaults to provider deepseek / model deepseek-v4-flash via Lico Arc profiles. Returns job_id immediately. Do not change Codex model config.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "User task text for the sub-agent.",
        },
        system: {
          type: "string",
          description: "Optional system instruction for the sub-agent.",
        },
        provider: {
          type: "string",
          description: `Lico Arc provider id (default: ${DEFAULT_PROVIDER}).`,
        },
        model: {
          type: "string",
          description: `Model id selected by Lico Arc profile (default: ${DEFAULT_MODEL}).`,
        },
        label: {
          type: "string",
          description: "Optional short label for progress summaries.",
        },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "get_subagent_status",
    description:
      "Poll status and progress for a previously spawned Lico Arc sub-agent job.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Job id returned by spawn_subagent.",
        },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "await_subagent",
    description:
      "Block until a sub-agent job completes, fails, is cancelled, or the timeout elapses. Prefer this after spawn_subagent unless you need custom polling.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Job id returned by spawn_subagent.",
        },
        timeout_ms: {
          type: "number",
          description: `Max wait in milliseconds (default ${DEFAULT_AWAIT_MS}, max ${MAX_AWAIT_MS}).`,
        },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "cancel_subagent",
    description:
      "Request cancellation of an in-flight Lico Arc sub-agent job when possible.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Job id returned by spawn_subagent.",
        },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
];

function now() {
  return Date.now();
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function textResult(payload, isError = false) {
  return {
    content: [
      {
        type: "text",
        text:
          typeof payload === "string"
            ? payload
            : JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: typeof payload === "object" ? payload : undefined,
    isError,
  };
}

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function publicJob(job) {
  return {
    job_id: job.jobId,
    status: job.status,
    provider: job.provider,
    model: job.model,
    progress: job.progress,
    stage: job.stage,
    mode: job.mode ?? null,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    started_at: job.startedAt ?? null,
    completed_at: job.completedAt ?? null,
    output: job.output ?? null,
    error: job.error ?? null,
    cancel_requested: job.cancelRequested,
  };
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("cancelled"), { code: "CANCELLED" }));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("cancelled"), { code: "CANCELLED" }));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function runCommand(command, args, { input, signal, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const onAbort = () => {
      child.kill("SIGTERM");
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    if (input != null) {
      child.stdin.write(String(input));
    }
    child.stdin.end();
  });
}

async function commandExists(binary) {
  const checker = process.platform === "win32" ? "where" : "which";
  try {
    const result = await runCommand(checker, [binary]);
    return result.code === 0;
  } catch {
    return false;
  }
}

function extractOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed?.output === "string" && parsed.output.trim()) {
      return parsed.output.trim();
    }
    if (typeof parsed?.content === "string" && parsed.content.trim()) {
      return parsed.content.trim();
    }
    if (parsed?.ok === false) {
      const message =
        typeof parsed.message === "string"
          ? parsed.message
          : typeof parsed.error === "string"
            ? parsed.error
            : "lico-client returned ok=false";
      throw Object.assign(new Error(message), {
        code: "LICO_CLIENT_ERROR",
        detail: parsed,
      });
    }
    return trimmed;
  } catch (error) {
    if (error?.code === "LICO_CLIENT_ERROR") throw error;
    return trimmed;
  }
}

async function invokeProviderChat({ provider, model, prompt, system, signal }) {
  const mode = (process.env.LICOARC_SUBAGENT_MODE || "").trim().toLowerCase();
  if (mode === "stub") {
    await sleep(40, signal);
    return {
      mode: "stub",
      output: [
        "[licoarc-subagent stub]",
        `provider=${provider}`,
        `model=${model}`,
        "This is a local stub response. Wire lico-client provider-chat or set LICOARC_PROVIDER_CHAT_COMMAND for live DeepSeek forwarding.",
        "",
        `Echo prompt: ${prompt.slice(0, 500)}`,
      ].join("\n"),
    };
  }

  const custom = (process.env.LICOARC_PROVIDER_CHAT_COMMAND || "").trim();
  if (custom) {
    const rendered = custom
      .replaceAll("{provider}", provider)
      .replaceAll("{model}", model)
      .replaceAll("{text}", prompt)
      .replaceAll("{system}", system || "");
    const result = await runCommand("sh", ["-lc", rendered], {
      signal,
      env: {
        LICOARC_SUBAGENT_PROVIDER: provider,
        LICOARC_SUBAGENT_MODEL: model,
        LICOARC_SUBAGENT_PROMPT: prompt,
        LICOARC_SUBAGENT_SYSTEM: system || "",
      },
    });
    if (result.code !== 0) {
      throw Object.assign(
        new Error(
          `LICOARC_PROVIDER_CHAT_COMMAND failed (exit ${result.code}): ${(result.stderr || result.stdout).trim() || "no output"}`,
        ),
        { code: "CUSTOM_COMMAND_FAILED" },
      );
    }
    return { mode: "custom-command", output: extractOutput(result.stdout) };
  }

  const hasClient = await commandExists("lico-client");
  if (!hasClient) {
    throw Object.assign(
      new Error(
        "lico-client not found on PATH. Install Lico Arc native CLI, configure a DeepSeek credential in Lico Arc model-forwarding, then retry. For install smoke tests set LICOARC_SUBAGENT_MODE=stub.",
      ),
      { code: "LICO_CLIENT_MISSING" },
    );
  }

  // Preferred surface: Lico Arc model-forwarding provider_chat.
  const preferred = await runCommand(
    "lico-client",
    [
      "provider-chat",
      "--provider",
      provider,
      "--model",
      model,
      "--text",
      prompt,
      ...(system ? ["--system", system] : []),
    ],
    { signal },
  );
  if (preferred.code === 0) {
    return {
      mode: "lico-client-provider-chat",
      output: extractOutput(preferred.stdout),
    };
  }

  const preferredErr = `${preferred.stderr}\n${preferred.stdout}`.toLowerCase();
  const unknownSubcommand =
    preferredErr.includes("unknown") ||
    preferredErr.includes("unrecognized") ||
    preferredErr.includes("usage:") ||
    preferredErr.includes("invalid");

  if (!unknownSubcommand) {
    throw Object.assign(
      new Error(
        `lico-client provider-chat failed: ${(preferred.stderr || preferred.stdout).trim() || `exit ${preferred.code}`}`,
      ),
      { code: "PROVIDER_CHAT_FAILED" },
    );
  }

  // Existing non-invasive fallback: profile forward (still does not patch Codex config).
  const forward = await runCommand(
    "lico-client",
    ["forward", "--profile", provider, "--text", prompt],
    { signal },
  );
  if (forward.code === 0) {
    return {
      mode: "lico-client-forward",
      output: extractOutput(forward.stdout),
    };
  }

  throw Object.assign(
    new Error(
      [
        "lico-client provider-chat / forward failed.",
        `provider-chat: ${(preferred.stderr || preferred.stdout).trim() || `exit ${preferred.code}`}`,
        `forward: ${(forward.stderr || forward.stdout).trim() || `exit ${forward.code}`}`,
        "Configure a DeepSeek credential in Lico Arc model-forwarding, ensure a current lico-client is on PATH, or set LICOARC_PROVIDER_CHAT_COMMAND.",
      ].join(" "),
    ),
    { code: "PROVIDER_CHAT_UNAVAILABLE" },
  );
}

async function runJob(job) {
  job.status = "running";
  job.startedAt = now();
  job.updatedAt = job.startedAt;
  job.progress = 0.05;
  job.stage = "dispatching";
  job.controller = new AbortController();

  try {
    job.progress = 0.2;
    job.stage = "calling-lico-arc";
    job.updatedAt = now();

    const result = await invokeProviderChat({
      provider: job.provider,
      model: job.model,
      prompt: job.prompt,
      system: job.system,
      signal: job.controller.signal,
    });

    if (job.cancelRequested) {
      job.status = "cancelled";
      job.stage = "cancelled";
      job.progress = 1;
      job.error = "cancelled by request";
      job.completedAt = now();
      job.updatedAt = job.completedAt;
      return;
    }

    job.mode = result.mode;
    job.output = result.output;
    job.status = "completed";
    job.stage = "completed";
    job.progress = 1;
    job.completedAt = now();
    job.updatedAt = job.completedAt;
  } catch (error) {
    if (error?.code === "CANCELLED" || job.cancelRequested) {
      job.status = "cancelled";
      job.stage = "cancelled";
      job.progress = 1;
      job.error = "cancelled by request";
    } else {
      job.status = "failed";
      job.stage = "failed";
      job.progress = 1;
      job.error = error?.message || String(error);
      if (error?.code) {
        job.error = `[${error.code}] ${job.error}`;
      }
    }
    job.completedAt = now();
    job.updatedAt = job.completedAt;
  } finally {
    job.controller = undefined;
  }
}

function getJobOrThrow(jobId) {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error(`Unknown job_id: ${jobId}`);
  }
  return job;
}

async function handleSpawn(args) {
  const prompt = requireNonEmptyString(args?.prompt, "prompt");
  const provider =
    typeof args?.provider === "string" && args.provider.trim()
      ? args.provider.trim()
      : DEFAULT_PROVIDER;
  const model =
    typeof args?.model === "string" && args.model.trim()
      ? args.model.trim()
      : DEFAULT_MODEL;
  const system =
    typeof args?.system === "string" && args.system.trim()
      ? args.system.trim()
      : undefined;
  const label =
    typeof args?.label === "string" && args.label.trim()
      ? args.label.trim()
      : undefined;

  const jobId = randomUUID();
  const createdAt = now();
  /** @type {Job} */
  const job = {
    jobId,
    status: "queued",
    provider,
    model,
    prompt,
    system,
    createdAt,
    updatedAt: createdAt,
    progress: 0,
    stage: label ? `queued:${label}` : "queued",
    cancelRequested: false,
  };
  jobs.set(jobId, job);

  // Fire-and-forget async job; tools poll/await for completion.
  queueMicrotask(() => {
    void runJob(job);
  });

  return textResult({
    ok: true,
    job_id: jobId,
    status: job.status,
    provider,
    model,
    message:
      "Sub-agent job spawned. Call await_subagent (preferred) or get_subagent_status until terminal status.",
  });
}

async function handleStatus(args) {
  const jobId = requireNonEmptyString(args?.job_id, "job_id");
  const job = getJobOrThrow(jobId);
  return textResult({
    ok: true,
    ...publicJob(job),
  });
}

async function handleAwait(args) {
  const jobId = requireNonEmptyString(args?.job_id, "job_id");
  const job = getJobOrThrow(jobId);
  let timeoutMs = DEFAULT_AWAIT_MS;
  if (typeof args?.timeout_ms === "number" && Number.isFinite(args.timeout_ms)) {
    timeoutMs = Math.max(1, Math.min(MAX_AWAIT_MS, Math.floor(args.timeout_ms)));
  }

  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    if (
      job.status === "completed" ||
      job.status === "failed" ||
      job.status === "cancelled"
    ) {
      return textResult(
        {
          ok: job.status === "completed",
          timed_out: false,
          ...publicJob(job),
        },
        job.status === "failed",
      );
    }
    await sleep(POLL_SLICE_MS);
  }

  return textResult(
    {
      ok: false,
      timed_out: true,
      ...publicJob(job),
      message: `Timed out after ${timeoutMs}ms; job still ${job.status}. Continue with get_subagent_status or await_subagent.`,
    },
    true,
  );
}

async function handleCancel(args) {
  const jobId = requireNonEmptyString(args?.job_id, "job_id");
  const job = getJobOrThrow(jobId);
  if (
    job.status === "completed" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
    return textResult({
      ok: true,
      cancelled: false,
      message: `Job already terminal (${job.status}).`,
      ...publicJob(job),
    });
  }

  job.cancelRequested = true;
  job.updatedAt = now();
  job.stage = "cancel_requested";
  job.controller?.abort();

  const deadline = now() + 5_000;
  while (now() < deadline) {
    if (job.status === "cancelled" || job.status === "failed" || job.status === "completed") {
      break;
    }
    await sleep(POLL_SLICE_MS);
  }

  if (job.status === "queued" || job.status === "running") {
    job.status = "cancelled";
    job.stage = "cancelled";
    job.progress = 1;
    job.error = "cancelled by request";
    job.completedAt = now();
    job.updatedAt = job.completedAt;
  }

  return textResult({
    ok: true,
    cancelled: job.status === "cancelled",
    ...publicJob(job),
  });
}

async function callTool(name, args) {
  switch (name) {
    case "spawn_subagent":
      return handleSpawn(args);
    case "get_subagent_status":
      return handleStatus(args);
    case "await_subagent":
      return handleAwait(args);
    case "cancel_subagent":
      return handleCancel(args);
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), {
        code: "METHOD_NOT_FOUND",
      });
  }
}

async function handleRequest(message) {
  const { id, method, params } = message;
  try {
    switch (method) {
      case "initialize":
        sendResult(id, {
          protocolVersion: "2024-11-05",
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          capabilities: { tools: {} },
        });
        return;
      case "notifications/initialized":
      case "notifications/cancelled":
        return;
      case "ping":
        sendResult(id, {});
        return;
      case "tools/list":
        sendResult(id, { tools: TOOLS });
        return;
      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments ?? {};
        if (typeof toolName !== "string" || !toolName) {
          sendError(id, -32602, "tools/call requires name");
          return;
        }
        const result = await callTool(toolName, toolArgs);
        sendResult(id, result);
        return;
      }
      default:
        sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    if (id === undefined || id === null) return;
    sendResult(
      id,
      textResult(
        {
          ok: false,
          error: error?.message || String(error),
        },
        true,
      ),
    );
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }
  if (message?.jsonrpc !== "2.0") return;
  if (Object.prototype.hasOwnProperty.call(message, "id")) {
    void handleRequest(message);
  }
});

rl.on("close", () => {
  process.exit(0);
});
