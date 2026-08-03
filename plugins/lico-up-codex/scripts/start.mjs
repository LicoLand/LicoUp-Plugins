#!/usr/bin/env node
import {
  resolvePackagedRuntime,
  runtimeCommandName,
  startRuntime,
} from "./runtime.mjs";

const GENERIC_FAILURE = "LicoUp subordinate-agent runtime is unavailable. Install or update LicoUp, then retry.";

function relaySignal(child, signal) {
  if (!child.killed) child.kill(signal);
}

function run(command, allowFallback) {
  const child = startRuntime(command);
  child.once("spawn", () => {
    process.once("SIGINT", () => relaySignal(child, "SIGINT"));
    process.once("SIGTERM", () => relaySignal(child, "SIGTERM"));
  });
  child.once("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
  child.once("error", async (error) => {
    if (allowFallback && error.code === "ENOENT") {
      try {
        const packaged = await resolvePackagedRuntime();
        if (packaged) {
          run(packaged, false);
          return;
        }
      } catch {
        // The generic error below deliberately omits local path details.
      }
    }
    console.error(GENERIC_FAILURE);
    process.exitCode = 1;
  });
}

try {
  if (process.env.LICOUP_SUBAGENT_MCP_PATH) {
    run(await resolvePackagedRuntime(), false);
  } else {
    run(runtimeCommandName(), true);
  }
} catch {
  console.error(GENERIC_FAILURE);
  process.exitCode = 1;
}
