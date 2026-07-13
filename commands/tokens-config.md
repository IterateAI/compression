---
description: View or update token-optimizer plugin configuration
argument-hint: "[key=value] [key=value] ..."
allowed-tools: Read, Write, Bash(node:*)
---

Manage the token-optimizer plugin configuration.

Arguments: $ARGUMENTS

The config file lives at `~/.claude/plugins/agentone-token-compression/data/config.json`.

**If no arguments**: Read the current config and pretty-print it. Also list available keys with short descriptions:

- `exactCache.enabled` (bool, default true) — exact-match cache
- `exactCache.ttlMs` (int, default 604800000 = 7d) — cache entry TTL
- `semanticCache.enabled` (bool, default true) — fuzzy similarity cache
- `semanticCache.threshold` (float 0..1, default 0.92) — similarity threshold; lower = more hits but more false positives
- `pipeline.contentRouter.codeMode` ('comments' | 'ast', default 'comments') — set 'ast' for aggressive code compression
- `pipeline.contentRouter.aggressive` (bool, default false) — enable aggressive content-type compression
- `pipeline.abbreviation.enabled` (bool, default false) — phrase abbreviation (off by default to preserve user intent)
- `pipeline.entropyProtection.enabled` (bool, default true) — protect API keys/UUIDs from rewriting
- `pipeline.dedupe.enabled` (bool, default true) — message-level dedup

**If arguments are given as `key=value` pairs**: parse each, validate, update the config, and write it back. Then run the stats command to confirm the new settings took effect.

For example:
- `/tokens-config semanticCache.threshold=0.85` → lower threshold for more cache hits
- `/tokens-config pipeline.contentRouter.codeMode=ast` → enable AST body-drop on code
- `/tokens-config pipeline.abbreviation.enabled=true` → enable phrase abbreviation

Booleans accept: true, false, 1, 0, yes, no.
