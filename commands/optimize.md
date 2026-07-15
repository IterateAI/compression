---
description: AgentOne Token Compression — analyze current usage and apply optimizations interactively
argument-hint: "[auto] (optional: apply suggestions without prompting)"
allowed-tools: Bash(node:*), Read, Write
---

Interactive optimization mode.

Argument: $ARGUMENTS

Step 1 — Gather current state:

```bash
!node "${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/agentone-token-compression}/dist/scripts/print-stats.js"
```

```bash
!cat $HOME/.claude/plugins/agentone-token-compression/data/config.json 2>/dev/null || echo '{}'
```

Step 2 — Analyze the stats and decide which optimizations would help most. For each potential change, compute the expected impact. Examples:

- **If cache hit rate < 15% and total requests > 50**: lowering `semanticCache.threshold` from 0.92 to 0.85 will likely double the hit rate, adding 20-40% more savings.
- **If code-heavy file reads detected (look for high tokensSeen on PostToolUse with low % saved)**: enabling `pipeline.contentRouter.codeMode=ast` typically adds 30-50% on code.
- **If abbreviation is off and UserPromptSubmit calls > 20**: enabling `pipeline.abbreviation.enabled=true` adds 10-30% on prose prompts.
- **If exact cache near capacity (size > 80% of maxEntries)**: bump `exactCache.maxEntries` to 5000.

Step 3 — Present the user with a ranked list of recommendations. For EACH recommendation include:
- One-line summary
- Expected savings % range
- 2-3 explicit trade-off bullets so the user can give informed consent

Format example:

```
🎯 Recommended optimizations (ranked by impact):

1. Enable AST body-drop                              [HIGH · +30-50% on code]
   Summary: Compress code by keeping signatures + types + docstrings, dropping function bodies.
   Trade-offs:
     • Claude sees signatures + types + docstrings but NOT function bodies (fine for navigation, weaker for line-by-line debugging).
     • Lossless via CCR — Claude can call retrieve_compressed(id) to get the body back when needed.
     • Python uses stdlib `ast` (100% accurate); JS/TS uses brace-balanced regex (~95% on common patterns).
   Apply: pipeline.contentRouter.codeMode = "ast"

2. Loosen semantic cache threshold                   [MEDIUM · +15-25% via more hits]
   Summary: Lower fuzzy-match threshold from 0.92 to 0.85 so near-duplicate prompts hit the cache.
   Trade-offs:
     • Hit rate typically 2-3x; latency improves on hits.
     • Rare false-positive matches where a slightly different prompt returns a previous response.
     • Mitigate by running /tokens-reset cache on workload changes.
   Apply: semanticCache.threshold = 0.85

3. Enable phrase abbreviation                        [LOW · +5-15% on prose prompts]
   Summary: Rewrite verbose phrases ("please could you in order to" → "to") before sending.
   Trade-offs:
     • Your prose is rewritten; quotes, code blocks, and API keys preserved verbatim.
     • No measurable accuracy impact in benchmarks against GPT-4 and Claude.
     • Disable if you need exact-wording preservation.
   Apply: pipeline.abbreviation.enabled = true
```

Step 4 — Apply them:

- If `$ARGUMENTS == "auto"`: apply all HIGH and MEDIUM impact suggestions automatically. Skip LOW unless explicitly requested.
- Otherwise: ask the user which ones to apply (numbered selection like `1,2` or `all` or `none`). For each accepted suggestion, edit `~/.claude/plugins/agentone-token-compression/data/config.json` to merge the change. Use Read + Write for safe atomic updates.

Step 5 — Confirmation:

After applying, show the new config and tell the user the changes will take effect on the next request (no restart needed — hooks load the config each call).

Run `/optimize_dashboard` after they use Claude for a bit to see the actual impact.

## Important safety notes

- NEVER recommend disabling entropy protection — that protects API keys and secrets.
- NEVER recommend `pipeline.abbreviation.aggressive=true` without warning that it changes the user's prose.
- ALWAYS preserve existing config keys you're not changing (merge, don't replace).
