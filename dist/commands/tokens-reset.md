---
description: Clear token-optimizer caches and/or stats
argument-hint: [cache|stats|all]
allowed-tools: Bash(node:*)
---

Reset token-optimizer state.

Argument: $ARGUMENTS (defaults to `cache` if empty)

Valid targets:
- `cache` — clear semantic + exact caches (frees disk + forces fresh compression next time)
- `stats` — clear lifetime + per-session stats counters
- `all` — clear both

Ask the user to confirm before proceeding (single yes/no question), then run:

```bash
!node $HOME/.claude/plugins/agentone-token-compression/scripts/reset.js {TARGET}
```

After reset, show a brief confirmation with what was cleared and the new state.
