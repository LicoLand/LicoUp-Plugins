import { constants } from "node:fs";
import { access, lstat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { spawn } from "node:child_process";

const RUNTIME_NAME = process.platform === "win32"
  ? "lico-subagent-mcp.exe"
  : "lico-subagent-mcp";

function packagedCandidates(environment = process.env, home = homedir()) {
  if (process.platform === "darwin") {
    return [
      join("/Applications", "LicoUp.app", "Contents", "Resources", "plugins", "lico-up-codex", "bin", RUNTIME_NAME),
      join(home, "Applications", "LicoUp.app", "Contents", "Resources", "plugins", "lico-up-codex", "bin", RUNTIME_NAME),
    ];
  }
  if (process.platform === "win32") {
    return [environment.LOCALAPPDATA, environment.ProgramFiles]
      .filter(Boolean)
      .map((root) => join(root, "LicoUp", "resources", "plugins", "lico-up-codex", "bin", RUNTIME_NAME));
  }
  return [
    environment.APPDIR
      ? join(environment.APPDIR, "usr", "lib", "licoup", "plugins", "lico-up-codex", "bin", RUNTIME_NAME)
      : null,
    join("/opt", "LicoUp", "resources", "plugins", "lico-up-codex", "bin", RUNTIME_NAME),
    join("/usr", "lib", "licoup", "plugins", "lico-up-codex", "bin", RUNTIME_NAME),
  ].filter(Boolean);
}

async function isExecutableFile(path) {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) return false;
    await access(path, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolvePackagedRuntime(environment = process.env, options = {}) {
  const override = environment.LICOUP_SUBAGENT_MCP_PATH;
  if (override) {
    if (isAbsolute(override) && await isExecutableFile(override)) return override;
    throw new Error("licoup_runtime_override_invalid");
  }
  const candidates = options.candidates ?? packagedCandidates(environment, options.home);
  for (const candidate of candidates) {
    if (await isExecutableFile(candidate)) return candidate;
  }
  return null;
}

export function startRuntime(command, options = {}) {
  return spawn(command, [], {
    env: options.environment ?? process.env,
    stdio: "inherit",
    windowsHide: true,
  });
}

export function runtimeCommandName() {
  return RUNTIME_NAME;
}
