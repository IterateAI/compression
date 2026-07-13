# Changelog

## [Unreleased]
### Added
- Closed-loop compression governor (opt-in, `governor.enabled`): auto-tunes compression aggressiveness per tenant and content-type from downstream quality/cost signals (tokenGuard reverts, CCR lost-retrievals, cache-miss anomalies, and optional retry/shadow-eval signals) via an epsilon-greedy bandit, with a hard quality-guardrail that rolls back aggressiveness on any regression. Never disables safety transforms. Off by default.
- Prefix-resident dictionary codec (opt-in, `dictionary.enabled`): mines recurring long strings per tenant, renders them as a glossary in the cache-priced prompt prefix, and substitutes short codes into volatile content — the dictionary is billed at the cached rate while substitutions save the full rate. Works standalone as a Claude skill (model decodes the glossary inline); when a gateway/MCP retrieval backend is present it additionally offers lossless expansion via CCR. Off by default.
- Cache-economics scheduler (opt-in, `cacheEconomics.enabled`): freezes compressed history bytes so provider prompt caches stay hot, prices every mutation of frozen content against provider cache economics before allowing it, manages `cache_control` breakpoints (Anthropic), batches history compaction, and calibrates from provider cache-usage telemetry. Off by default; primarily for long-running gateways.
- Token-guard: lossy passes (abbreviation, stopwords, aggressive whitespace) now measure token count and revert rewrites that don't pay off.
- Lossless tabular JSON re-encoding (`__cols`/`rows`) replaces lossy array collapse as the default aggressive-mode behavior; collapse is now opt-in.
- Semantic cache: optional cheap-model hit verification (off by default in the plugin).
- Bundled library: CCR idle-based TTL (2h) with session namespacing — long-running gateways keep compressed-block retrieval alive across a session.

## 1.1.0 — AgentOne rebrand + Claude Desktop support + smart suggestions

- **Rebranded** as **AgentOne Token Compression** by Iterate.ai (part of the AgentOne platform)
- **Claude Desktop support** via bundled MCP server (`mcp-server/index.js`)
  - 5 tools exposed: `compress`, `analyze`, `stats`, `clear_cache`, `optimize`
  - Zero-dep MCP wire protocol (JSON-RPC over stdio)
  - Platform-specific `claude_desktop_config.json` templates for macOS / Windows / Linux
  - Full install guide: `INSTALL_DESKTOP.md`
- **New `/optimize_dashboard` slash command** (renamed from `/compression` to avoid clash with Claude's built-in `/compress`)
  - Read-only dashboard: stats, config, $ saved, optimization tips
  - Never modifies settings — safe to run constantly
- **New `/optimize` slash command** + MCP tool
  - Analyzes usage and recommends config changes ranked by HIGH/MEDIUM/LOW impact
  - Each recommendation includes:
    - Expected savings % range
    - "Applies to" context (what content types benefit)
    - 2-3 explicit trade-off bullets for informed consent
  - `/optimize auto` applies HIGH-impact recommendations automatically
- **Threshold-based optimize suggestion** in PostToolUse hook
  - After 30+ requests with <35% reduction OR <15% cache hit rate, the hook adds a one-line nudge to Claude's context: "[AgentOne tip] Run /optimize to unlock +30-50%..."
  - 24-hour cooldown — never nags more than once a day
  - Suppressed when user has already enabled AST mode + tightened semantic threshold
  - Permanent dismissal via `/tokens-config dismissSuggestions=true`
- Hooks tests: 11 → 11 (unchanged)
- MCP tests: new — 13 passing
- Suggestion tests: new — 9 passing
- **Total plugin tests: 33 passing**

## 1.0.0 — initial release

- **PostToolUse hook** compresses Read, Bash, Grep, Glob, WebFetch, NotebookRead outputs
- **UserPromptSubmit hook** analyzes & lightly compresses large user prompts
- **SessionEnd hook** emits a session summary
- **Status line** showing live token savings
- **Slash commands**: `/tokens`, `/compress`, `/tokens-config`, `/tokens-reset`, `/tokens-off`, `/tokens-on`
- **Auto-invocable skill** for proactive compression suggestions
- **Persistent file-backed cache** (exact + semantic) across Claude Code sessions
- **One-line installer** with idempotent merge into existing settings.json
- **Master kill-switch**: `TOKEN_OPTIMIZER_DISABLED=1`
- Built-in protection for API keys, UUIDs, hashes, URLs, JWTs, PEM blocks (mask-union architecture)
- Tool-specific optimization paths:
  - Bash/Grep: aggressive line-collapse with semver/path/ID masking
  - WebFetch: HTML/script/style/comment strip
  - Read on code: opt-in AST body-drop via `code_mode=ast`
  - Read on JSON: minify + null-strip + array-depth compression + string dedup
  - Read on logs: template-mask + repeat-collapse with head/tail keep
- **Benchmark numbers**: 78% overall savings on typical workload, 89-100% on logs/Bash/Grep, 76ms avg latency
