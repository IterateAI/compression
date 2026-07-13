---
name: agentone-token-compression
description: Use proactively when the user pastes a large block of content (1000+ chars of JSON, logs, code, file content), when context is getting full and Claude should compress before continuing, or when the user mentions tokens, cost, context limit, AgentOne, or compression. Routes to the right optimizer (JSON minify, dictionary/dedupe, AST body-drop, semantic cache) via AgentOne Token Compression by Iterate.ai.
allowed-tools: Bash(node:*), Read
---

# AgentOne Token Compression Skill

You have access to **AgentOne Token Compression** by Iterate.ai via either the
AgentOne MCP server (Claude Desktop) or the bundled CLI (Claude Code / manual).
In Claude Code, compression also runs automatically via hooks — this skill is for
*explicit, on-demand* compression and for the Desktop MCP path.

## When to use this skill (proactively)

Invoke BEFORE responding when ANY of these apply:

1. **User pasted a large block** (≥1000 chars) of JSON, logs, code, or file
   content — compress it first, then work with the compressed version.
2. **Context is filling up** — you've read several large files or the
   conversation is long.
3. **The user mentions any of**: "context window", "token usage", "running out
   of context", "compress", "minify", "shrink", "too verbose", "save costs",
   "token cost", "cheaper", "fit more".
4. **Before forwarding tool output to a subagent** — compress first to keep the
   subagent's context tight.

## How to use

### Claude Desktop — call the MCP `compress` tool

Pass the content as `text`, plus mode arguments as appropriate:

- `compress({ text, codeMode: "ast" })` — for code you only need an *overview* of
  (the clearest win; bodies dropped, retrievable).
- `compress({ text })` — default; already strong on JSON and repetitive code, and
  the correct choice for prose.
- `compress({ text, aggressive: true })` — optional on JSON / structured data;
  safe there, but don't count on a large extra gain. **Never** on prose (lossy).

Use `analyze({ text })` first if you want a type + savings estimate without
modifying anything.

### Claude Code / manual — call the bundled CLI

The path points at the **self-contained** `dist/` bundle (works without any
`node_modules`):

```bash
cat path/to/file.json | node "$HOME/.claude/plugins/agentone-token-compression/dist/scripts/compress-stdin.js" --aggressive
```

Flags:
- `--aggressive` — aggressive content-type compression (JSON/structured).
- `--ast` — drop function bodies on code (signatures + types + doc comments kept;
  reversible via the `retrieve` tool).
- *(no flag)* — conservative default; use for prose.

Output:
```
---SUMMARY---
{ "detectedType": "json", "mode": {...}, "beforeTokens": 2274, "afterTokens": 903, "savedPct": 60.3, ... }
---COMPRESSED---
<the compressed content>
```

## Choosing the mode (measured guidance)

The engine auto-tunes the compression level via a learning "governor", so default
mode is already strong on structured content. Pick a mode by content type — do
**not** assume aggressive always helps:

| Content type | Mode | What to expect (measured) |
|---|---|---|
| Code — overview only | `codeMode: "ast"` (`--ast`) | the one deterministic lever — drops function bodies (retrievable); use for large/diverse code |
| Code — repetitive | default | dictionary/dedupe already ~80–90% |
| JSON / structured data | default (optionally `aggressive`) | default ~50%; `aggressive` is safe here but may add little (the governor already explores) |
| Logs | default | **only exact-duplicate lines compress**; logs with unique per-line values (ids/timestamps) may save ~0% |
| Prose / natural language | **default — never aggressive** | modest; aggressive is LOSSY on prose (rewrites wording) |

Rules:
- **Code → use `ast` only when the user wants to understand/navigate, not run or
  debug** the code (bodies are dropped; retrieve them on demand). This is the
  clearest, most reliable win.
- **JSON / structured → default is already good.** `aggressive` is safe to add
  (structural, not lossy) but treat any extra savings as a bonus, not a promise.
- **Prose → never aggressive.** Aggressive rewrites wording and is lossy on prose.
- **Never quote a savings % in advance.** Run the compressor and report the
  actual `savedPct`. Savings vary by content and can vary run-to-run while the
  governor is still learning.

## Preservation guarantees (tell the user when relevant)

Protected (never modified), in every mode:
- API keys, JWTs, tokens (sk-, sk-ant-, AKIA, gh[pso]_, Bearer, eyJ...)
- UUIDs, hashes (SHA, MD5, base64 ≥16 chars)
- URLs (https://...)
- Long numeric IDs (10+ digit)
- High-entropy content (Shannon entropy > 0.85, multi-class)

So users can safely compress content containing secrets — they survive verbatim.

## What NOT to do

- Don't compress short content (< 500 chars) — overhead exceeds savings.
- Don't use aggressive on prose, or `ast` on code the user needs to run/debug.
- Don't compress content where every character matters (cryptographic input,
  exact-match assertions).
- Don't claim AST is lossless up front — bodies are dropped, then retrievable on
  demand. Use it for "give me an overview", not "I need to run this".
- Don't quote a savings % before running — report the actual `savedPct` from the
  result.

## Retrieving elided function bodies (REVERSIBLE AST)

When code is compressed with `ast`, function bodies are replaced with a marker
like `{ /* AGENTONE-ELIDED:<id> — call retrieve("<id>") for the N-line body */ }`.
Signatures, TS types, and doc comments are preserved; only the body is dropped.

When you see `AGENTONE-ELIDED:<id>` (or `retrieve("<id>")`) and you need the
implementation, call the `retrieve` tool with that id to get the exact original
body BEFORE relying on or modifying it. This makes AST compression lossless on
demand — navigate on signatures, retrieve bodies only when you actually need them.

## Slash commands available to the user

- `/tokens` — show lifetime stats and cost savings
- `/compress <text or file>` — manually compress something
- `/tokens-config key=value` — tune settings (e.g. `pipeline.contentRouter.aggressive=true`)
- `/tokens-reset cache|stats|all` — clear state
- `/tokens-off` / `/tokens-on` — temporarily disable
