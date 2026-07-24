# licoarc-for-codex

Codex plugin that delegates bounded subtasks to a **Lico Arc**–backed sub-agent (default **DeepSeek V4 Flash**) without modifying Codex model provider / `base_url` / original model config.

This package uses the retained LicoArc marketplace namespace. It is an
independent Codex developer tool: it is not a Meshrix runtime plugin, not a
LicoUp plugin or network component, and not a Fabrigent protocol or
certification authority. See the
[repository ecosystem boundary](../README.md#ecosystem-boundary).

## Layout

```
licoarc-for-codex/
  .codex-plugin/plugin.json
  .mcp.json
  assets/icon.svg
  mcp/server.mjs
  skills/lico-subagent/SKILL.md
  README.md
```

Repo marketplace entry (sibling catalog):

```
LicoArc-Plugins/.agents/plugins/marketplace.json
```

## Install (local marketplace)

From this repository root (`LicoArc-Plugins`):

```bash
codex plugin marketplace add .
```

Or in the ChatGPT / Codex desktop app:

1. Add the local marketplace root (`LicoArc-Plugins`).
2. Open Plugins → select **LicoArc Independent Plugins**.
3. Install **licoarc-for-codex** and enable it.
4. Confirm the bundled MCP server `licoarc-subagent` is enabled for the plugin.

Personal-marketplace alternative: copy or symlink this folder under your Codex plugins tree and point `~/.agents/plugins/marketplace.json` at it with a `./`-prefixed path relative to that marketplace root.

## Use

1. Enable the plugin (and MCP server) in Codex.
2. Ask Codex to use the **lico-subagent** skill, for example:
   - “Delegate a concise summary of this design note to the Lico Arc DeepSeek sub-agent and return the result.”
3. Codex should call `spawn_subagent`, then `await_subagent` (or poll `get_subagent_status`).

## Prerequisites for live forwarding

- Recent Lico Arc native CLI with `lico-client provider-chat` on `PATH`.
- DeepSeek (or other) credential configured in Lico Arc **model-forwarding** profiles.

Live call chain:

```text
Codex → plugin MCP → lico-client provider-chat → Lico Arc model-forwarding → DeepSeek HTTPS
```

### Environment knobs (MCP server)

| Variable | Purpose |
| --- | --- |
| `LICOARC_SUBAGENT_MODE=stub` | Force local stub completions (install / smoke tests). |
| `LICOARC_PROVIDER_CHAT_COMMAND` | Optional shell template override; substitutes `{provider}`, `{model}`, `{text}`, `{system}`. |

Default live path (when not stubbing):

```bash
lico-client provider-chat --provider deepseek --model deepseek-v4-flash --text "…"
```

Optional system instruction:

```bash
lico-client provider-chat --provider deepseek --text "…" --system "Be brief."
```

## MCP tools

| Tool | Role |
| --- | --- |
| `spawn_subagent` | Start async job → `job_id` |
| `get_subagent_status` | Poll status / progress |
| `await_subagent` | Wait until terminal status or timeout |
| `cancel_subagent` | Request cancellation |

Progress model is **async job + poll/await** (not MCP progress push into the main chat).

## Smoke-test the MCP server

```bash
cd licoarc-for-codex
npm run smoke
```

Stub mode is forced by the smoke script. For a command-path check without a real API key:

```bash
LICOARC_PROVIDER_CHAT_COMMAND='printf "%s\n" "{\"ok\":true,\"output\":\"wired\"}"' \
  node ./scripts/smoke-live-command.mjs
```

## Design notes

- Non-invasive: does not patch Codex `config.toml` (unlike older Lico Arc `apply_codex_patch` flows).
- Model selection and credentials stay in Lico Arc model-forwarding (`provider_chat`), not in Codex.
- Optional later: plugin hooks for session context; durable job store beyond the in-memory v0 map.
