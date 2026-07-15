---
description: Compress arbitrary content on demand — paste text, get back the compressed version
argument-hint: [text or file path]
allowed-tools: Read, Bash(node:*)
---

The user wants to compress content using the token-optimizer plugin.

Argument: $ARGUMENTS

If the argument looks like a file path (starts with / or ./ or ~), use Read to read it.
Otherwise, treat the argument itself as the content to compress.

Pick the mode by content type (same rules as the skill):
- **Code the user wants an overview of** → add `--ast` (drops function bodies,
  reversible via the `retrieve` tool). Skip `--ast` if they need to run/debug it.
  This is the clearest win.
- **JSON / structured data** → default is already strong; `--aggressive` is safe
  to add but may only help a little (the engine auto-tunes).
- **Prose / natural language** → no flag (aggressive is lossy on prose).

Then call the compressor (self-contained `dist/` bundle; add the chosen flag):

```bash
!echo "{CONTENT}" | node "${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/agentone-token-compression}/dist/scripts/compress-stdin.js" --aggressive
```

(Replace {CONTENT} with the actual content via stdin; the script reads from stdin.
Drop `--aggressive` for prose; use `--ast` instead for code overviews.)

Show the user:
1. **Original**: byte count, estimated token count, detected content type
2. **Compressed**: byte count, estimated token count, % saved
3. **Technique used**: which optimizers fired (dedupe, dictionary, JSON minify, AST body-drop, etc.)
4. **Compressed text** (in a code block)

Report the actual `savedPct` — don't promise a number in advance. Savings vary a
lot by content: JSON ~50%, repetitive code 80%+, but logs with unique per-line
values (ids/timestamps) may compress very little (~0%).

If the content contains API keys or other secrets, point out that those were preserved verbatim by the entropy/secret detectors.
