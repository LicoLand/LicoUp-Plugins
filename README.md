# LicoUp Plugins

LicoUp Plugins is the public repository boundary for optional external LicoUp
integrations. Its durable goal and boundaries are defined in
[PRODUCT.md](PRODUCT.md), and its vocabulary is defined in
[CONTEXT.md](CONTEXT.md).

## Current projection

The marketplace contains one external integration:

| Plugin | Purpose | Host contract |
| --- | --- | --- |
| [`lico-up-codex`](plugins/lico-up-codex) | Let Codex discover and coordinate other local agents through LicoUp | [LicoUp Subagent MCP](https://github.com/LicoLand/LicoUp/blob/main/docs/protocols/subagent-mcp.md) |

The plugin is a thin Codex integration. Agent scanning, native conversation
transport, local histories, and execution policy remain owned by the installed
LicoUp client.

See [docs/STATUS.md](docs/STATUS.md) for the separate intent,
implementation, verification, release, and support states. Catalog presence is
not evidence that an integration has been packaged, verified, released, or
supported.

## Install from a local checkout

```bash
codex plugin marketplace add .
codex plugin add lico-up-codex@licoup-plugins
```

Start a new Codex task after installation so its skill and MCP tools are
loaded. The current LicoUp application must be installed and provide its
companion `lico-subagent-mcp` runtime.

## Boundary projection

This repository owns optional external integration source and catalog entries.
It does not own the LicoUp client, endpoint encryption, key custody, local
approval, persistent client state, built-in client capabilities, or Lico Arc
Protocol governance.

An integration must enter through public LicoUp approval and host boundaries.
Installing one would not join a LicoUp network or confer Lico Arc Protocol
certification.

## Documentation

- [Product goal and boundaries](PRODUCT.md)
- [Ubiquitous language](CONTEXT.md)
- [Documentation index](docs/README.md)
- [Current five-dimension status](docs/STATUS.md)

## Version governance

The structured release authority and generated status are
[`docs/releases/plan.json`](docs/releases/plan.json) and
[`docs/releases/README.md`](docs/releases/README.md).
