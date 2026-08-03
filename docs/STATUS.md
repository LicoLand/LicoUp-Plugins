# LicoUp Plugins Status

This document reports five independent status dimensions for the current
repository candidate. A state in one dimension does not promote another.

## Intent

The approved destination is a marketplace for optional external integrations
that consume public, versioned LicoUp contracts and remain outside the client
security and state authority.

## Implementation

- The marketplace contains `lico-up-codex` version `0.1.0`.
- The plugin provides a Codex skill, MCP declaration, bounded cross-platform
  companion-runtime resolver, package metadata, license, and focused tests.
- It consumes the public LicoUp Subagent MCP contract and does not copy the
  target scanner, conversation adapters, client state, or approval logic.

## Verification

The plugin manifest validator, Node syntax checks, resolver tests, marketplace
consistency check, and a real local MCP `initialize` plus `tools/list` handshake
pass for the current candidate. The repository privacy workflow also passes.
These results verify the integration boundary; they do not independently
certify every subordinate agent or model provider discovered by LicoUp.

## Release

`0.1.0` is the planned first GitHub source release. It is not published
until the corresponding immutable tag and GitHub Release exist. Catalog
presence, source availability, and publication remain separate facts.

## Support

`lico-up-codex` is an initial integration for Codex installations with local
plugin support, Node.js 20 or newer, and a current LicoUp companion runtime.
Individual agent availability remains a runtime fact reported by LicoUp.
