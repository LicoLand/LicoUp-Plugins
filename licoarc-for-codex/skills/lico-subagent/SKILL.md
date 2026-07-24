---
name: lico-subagent
description: Delegate a bounded subtask to a Lico Arc–backed sub-agent (default DeepSeek V4 Flash) via MCP tools without changing Codex model provider, base_url, or original model config. Use when the user asks to offload work to Lico Arc / DeepSeek, or when a cheaper/faster Lico Arc profile is a better fit for a self-contained subtask.
---

# Lico Arc Sub-agent

## Hard rules

- **Never** ask the user to change Codex model provider settings, `base_url`, `config.toml`, or the session’s original model.
- Provider and model selection happen inside **Lico Arc** (model-forwarding profiles), not inside Codex.
- Default Lico Arc target: provider `deepseek`, model `deepseek-v4-flash`.
- Use the bundled MCP server tools only. Do not invent alternate config-patch flows.

## When to delegate

Delegate when:

- The user explicitly asks for Lico Arc / DeepSeek / a Lico-backed sub-agent.
- A bounded subtask (draft, summarize, translate, rewrite, classify, generate a short plan) can run independently and return text.
- Keeping the main Codex model for orchestration while offloading the heavy or alternate-provider work is useful.

Do **not** delegate when:

- The work needs the main Codex session’s tools, repo edits, or interactive clarifying dialogue mid-step.
- Credentials / Lico Arc are unavailable and the user did not ask for a stub/smoke path.

## Tool workflow

1. Call `spawn_subagent` with a clear `prompt` (and optional `system`, `provider`, `model`, `label`).
2. Immediately follow with `await_subagent` using the returned `job_id` (preferred), **or** poll `get_subagent_status` until status is `completed`, `failed`, or `cancelled`.
3. Summarize progress for the user in plain language while waiting when useful (queued → running → completed).
4. On completion, integrate the `output` into the main task. On failure, report the structured error and continue with the main Codex model unless the user wants a retry.
5. Use `cancel_subagent` only if the user abandons the subtask or a newer attempt supersedes it.

## Prompt craft

- Give the sub-agent a self-contained brief: goal, constraints, expected output shape.
- Do not assume it can see prior Codex tool results unless you paste the necessary context into `prompt`.
- Keep secrets out of prompts. Never echo credentials, tokens, or absolute personal machine paths.

## Progress model

This plugin uses **async job + poll/await**. Do not rely on MCP progress push into the main chat. Always `await_subagent` or poll after spawn.
