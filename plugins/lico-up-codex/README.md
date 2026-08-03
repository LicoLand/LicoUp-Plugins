# LicoUp Subagents for Codex

This Codex plugin lets the main Codex agent discover and coordinate other
locally available agents through LicoUp. It supports bounded readiness probes,
delegation, exact-conversation continuation, cancellation, and private local
handoffs.

## Requirements

- Codex with local plugin support.
- A current LicoUp installation that provides the `lico-subagent-mcp`
  companion runtime.
- Node.js 20 or newer in the Codex plugin environment.

The plugin first uses an explicit `LICOUP_SUBAGENT_MCP_PATH`, then a runtime on
`PATH`, and finally the standard LicoUp application package for the current
platform. Invalid overrides and missing runtimes fail closed without printing
searched local paths.

## Local boundary

The plugin starts the LicoUp-owned MCP over stdio. LicoUp scans installed local
agents and uses their native conversation adapters. Prompts and subordinate
results remain in local agent transports and local conversation history. The
MCP returns a private conversation-file handoff instead of copying subordinate
output into its tool response.

The normative host behavior is documented by LicoUp's
[Subagent MCP contract](https://github.com/LicoLand/LicoUp/blob/main/docs/protocols/subagent-mcp.md).

## Verification

```sh
npm run check
npm test
LICOUP_SUBAGENT_MCP_PATH=/absolute/path/to/lico-subagent-mcp npm run smoke
```

The tests use synthetic files and do not inspect local conversations, account
data, credentials, or installed-agent configuration.
