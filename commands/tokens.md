---
description: Show live token savings stats from the token-optimizer plugin
allowed-tools: Bash(node:*)
---

Display current token savings statistics from the token-optimizer plugin.

Run the stats reporter:

```bash
!node "${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/agentone-token-compression}/dist/scripts/print-stats.js"
```

Read the output and present a friendly summary to the user including:
- Total tokens saved (this session + lifetime)
- Cache hit rate
- Top hooks by savings
- Estimated cost savings (assume $3 per 1M input tokens for Claude Opus, $0.25 per 1M for Haiku, average ~$1.5/M for blended traffic)
- Suggestions for further optimization (e.g., "enable semantic cache" if hit rate < 30%)

Format the response with clear sections and emojis. Make it feel rewarding to see savings.
