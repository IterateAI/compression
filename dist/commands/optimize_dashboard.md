---
description: AgentOne Token Compression dashboard — lifetime stats, $ saved, current config, optimization tips (read-only; never modifies settings)
allowed-tools: Bash(node:*), Read
---

Show the comprehensive AgentOne Token Compression dashboard.

Run the stats reporter:

```bash
!node $HOME/.claude/plugins/agentone-token-compression/scripts/print-stats.js
```

Then read the current configuration:

```bash
!cat $HOME/.claude/plugins/agentone-token-compression/data/config.json 2>/dev/null || echo '{}'
```

Combine both into a rich dashboard with these sections:

## 📊 Compression Stats
- Total tokens seen, saved, % reduction (lifetime)
- Cache hit rate (overall + by exact vs semantic)
- Top hooks by savings (PostToolUse, UserPromptSubmit, MCP:compress)
- Top sessions

## 💰 Cost Savings
- Estimated $ saved at each Claude price tier (Opus, Sonnet, Haiku)
- Projected monthly savings at current rate (extrapolate from 7d window)

## ⚙️ Active Configuration
- Which hooks are enabled
- Cache TTLs and entry caps
- Code mode (`comments` vs `ast`)
- Entropy protection status
- Compression aggressiveness

## 💡 Optimization Tips (analyzed from the actual stats)
- If cache hit rate < 15%: suggest lowering `semanticCache.threshold` to 0.85
- If lifetime savings < 20%: suggest enabling `pipeline.contentRouter.codeMode=ast`
- If no recent activity: suggest the user check that hooks are wired in settings.json (run `/tokens-config` to view)
- If lots of UserPromptSubmit savings: suggest enabling `pipeline.abbreviation.enabled=true` for more aggressive prompt compression
- If savings > 500k tokens and cache hit rate > 30%: congratulate the user, mention they're getting top-tier value

## Quick actions
At the end, offer 3–5 one-line slash commands the user can run right now to act on the suggestions, e.g.:
- `/tokens-config pipeline.contentRouter.codeMode=ast` — enable AST body-drop
- `/tokens-config semanticCache.threshold=0.85` — looser semantic cache
- `/tokens-reset cache` — start fresh

Format with emojis and clear section headings to make it visually rewarding. The goal is for the user to feel "wow this saved me money" every time they run it.
