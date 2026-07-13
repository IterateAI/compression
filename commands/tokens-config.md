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

**Special case — `statusline=on` / `statusline=on!` / `statusline=off`**

This manages the live savings status bar, which lives in `~/.claude/settings.json`
(NOT the plugin config file). Do **not** hand-edit settings.json — run the bundled
setter, which does it safely (checks for an existing status line, backs up the file):

```bash
!SCRIPT="${CLAUDE_PLUGIN_ROOT}/dist/scripts/set-statusline.js"; [ -f "$SCRIPT" ] || SCRIPT="$(ls -d $HOME/.claude/plugins/cache/iterate-ai/agentone-token-compression/*/dist/scripts/set-statusline.js | sort -V | tail -1)"; node "$SCRIPT" on
```

- `statusline=on` → enable (won't overwrite a different existing status line)
- `statusline=on!` → force-enable (replace whatever status line is set)
- `statusline=off` → remove the AgentOne status line

Pass the matching word (`on` / `on!` / `off`) as the script argument. After it runs,
tell the user to **restart Claude Code** for the status bar to appear/disappear.
