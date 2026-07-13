---
description: Temporarily disable token-optimizer for this terminal (or set permanently)
argument-hint: [shell|permanent]
allowed-tools: Bash
---

Disable token-optimizer hooks.

Argument: $ARGUMENTS (defaults to `shell`)

If `shell` (default): tell the user to run `export TOKEN_OPTIMIZER_DISABLED=1` in their current shell. This is the safe way to disable for one session without modifying their settings.json.

If `permanent`: walk the user through editing `~/.claude/settings.json` to remove the hooks block, OR set `"env": { "TOKEN_OPTIMIZER_DISABLED": "1" }` in their settings.json. Don't actually modify their file without confirming first — show them the diff and ask for approval.

After explaining, also tell them how to re-enable:
- Shell: `unset TOKEN_OPTIMIZER_DISABLED`
- Permanent: `/tokens-on` slash command, or re-add the hooks block.
