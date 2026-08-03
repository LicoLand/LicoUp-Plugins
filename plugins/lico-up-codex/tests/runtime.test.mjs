import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  resolvePackagedRuntime,
  runtimeCommandName,
} from "../scripts/runtime.mjs";

test("uses one explicit executable runtime override", async () => {
  const root = await mkdtemp(join(tmpdir(), "licoup-plugin-runtime-"));
  const executable = join(root, runtimeCommandName());
  await writeFile(executable, "synthetic runtime\n");
  if (process.platform !== "win32") await chmod(executable, 0o700);
  assert.equal(
    await resolvePackagedRuntime({ LICOUP_SUBAGENT_MCP_PATH: executable }),
    executable,
  );
});

test("rejects an invalid override without returning its value", async () => {
  await assert.rejects(
    resolvePackagedRuntime({ LICOUP_SUBAGENT_MCP_PATH: "synthetic-missing-runtime" }),
    (error) => error.message === "licoup_runtime_override_invalid",
  );
});

test("rejects relative runtime overrides", async () => {
  await assert.rejects(
    resolvePackagedRuntime({ LICOUP_SUBAGENT_MCP_PATH: runtimeCommandName() }),
    (error) => error.message === "licoup_runtime_override_invalid",
  );
});

test("returns null when no packaged runtime is present", async () => {
  assert.equal(await resolvePackagedRuntime({}, { candidates: [] }), null);
});
