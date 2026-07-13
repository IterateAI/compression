---
description: Re-enable token-optimizer after it was disabled
allowed-tools: Bash
---

Re-enable token-optimizer hooks.

Instructions to the user:

1. If they previously ran `export TOKEN_OPTIMIZER_DISABLED=1` in this shell, run:
   ```
   unset TOKEN_OPTIMIZER_DISABLED
   ```

2. If they set `TOKEN_OPTIMIZER_DISABLED` in their `~/.claude/settings.json` `env` block, walk them through removing it.

3. If hooks were entirely removed from settings.json, show them the snippet from `~/.claude/plugins/agentone-token-compression/settings.json` to copy back, or suggest running:
   ```
   bash ~/.claude/plugins/agentone-token-compression/scripts/install.sh --reinstall-hooks
   ```

Then run `/tokens` to show that stats are now being recorded again.
