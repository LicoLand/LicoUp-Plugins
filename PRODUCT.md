# LicoUp Plugins Product

Status: durable product intent and boundary. This document is not
implementation, verification, release, support, or operation evidence.

## Goal

LicoUp Plugins provides a public home for optional external integrations that
extend LicoUp through explicit, versioned client contracts. Each integration
remains independently reviewable and removable while preserving LicoUp's
control over approval, endpoint protection, and local effects.

## Product boundary

This repository owns:

- the public catalog for optional external LicoUp integrations;
- the source and integration-specific documentation for those integrations;
- integration packaging and validation material owned by each integration;
- declarations that bind an integration to a public LicoUp contract.

An integration may enter only through public LicoUp approval and host
boundaries. Credentials remain behind explicit references. An integration may
expose a built-in client capability to another product only through a public
LicoUp contract; it does not copy or take ownership of the client
implementation.

## Non-goals

This repository does not own:

- the LicoUp client, endpoint keys, plaintext, encryption, local approval, or
  persistent client state;
- built-in LicoUp capabilities or client release evidence;
- Lico Arc Protocol federation rules, certification, or conformance;
- compatibility shells for retired products or contracts.

Current facts are maintained in [docs/STATUS.md](docs/STATUS.md).
