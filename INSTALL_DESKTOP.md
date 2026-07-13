# Installing AgentOne Token Compression on Claude Desktop

Claude Desktop doesn't have hooks like Claude Code, but it **does** support MCP (Model Context Protocol) servers. We ship a tiny MCP server that exposes our compression engine as 5 tools Claude can call: `compress`, `analyze`, `stats`, `optimize`, `clear_cache`.

The bundled `agentone-token-compression` skill teaches Claude when to invoke them automatically (e.g. when you paste large content).

## TL;DR — one command

```bash
agentone-tc install-desktop
```

That's it. The command auto-detects your OS, merges the MCP server entry into `claude_desktop_config.json`, copies the skill into the Desktop skills directory, and prints restart instructions. Backs up your existing config if it has to change anything.

Then fully quit Claude Desktop (Cmd-Q) and relaunch. You'll see `agentone-token-compression` with 5 tools under the 🔌 connector icon.

To roll back: `agentone-tc uninstall-desktop`.

Full manual steps below if you want to do it yourself.

## What you get on Claude Desktop

| Feature | Claude Code | Claude Desktop |
|---|---|---|
| Auto-compress every tool output | ✅ via PostToolUse hook | ❌ (Desktop doesn't have tool-output hooks) |
| Auto-compress on demand via skill | ✅ | ✅ via MCP `compress` tool |
| `/tokens` slash command | ✅ | ❌ (use `stats` MCP tool — Claude calls it for you) |
| `/compress` slash command | ✅ | ❌ (just paste text and ask Claude to compress it) |
| Persistent cache across sessions | ✅ | ✅ (same data dir) |
| Cost savings dashboard | ✅ via `/tokens` | ✅ via MCP `stats` tool |

The Desktop experience is **on-demand**: Claude calls the tools when it sees a reason to (the skill tells it to, or you ask). On Claude Code it's **always-on**, which is why Code gets the bigger savings.

## Prerequisites

- **Claude Desktop** installed (macOS, Windows, or Linux)
- **Node.js 18 or newer** — check with `node --version`
- The plugin files on disk somewhere stable (use the Claude Code installer; even if you don't use Claude Code, it puts files in the right place)

## Step 1 — Install the plugin files

If you also use Claude Code, you already have everything. Otherwise, get the files in place:

```bash
git clone https://github.com/IterateAI/compression
cd agentone-token-compression/claude_plugin
bash scripts/install.sh
```

This puts everything in `~/.claude/plugins/agentone-token-compression/`.

If you've never used Claude Code, that directory is fine — Claude Desktop reads from a different config file but the plugin lives at the same path.

## Step 2 — Add the MCP server to `claude_desktop_config.json`

Open your Claude Desktop config file. **Location depends on your OS:**

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Add the `agentone-token-compression` entry to the `mcpServers` block. If you don't have any MCP servers yet, your file should look like this:

### macOS / Linux

```json
{
  "mcpServers": {
    "agentone-token-compression": {
      "command": "node",
      "args": [
        "/Users/YOUR_USERNAME/.claude/plugins/agentone-token-compression/mcp-server/index.js"
      ]
    }
  }
}
```

Replace `/Users/YOUR_USERNAME` with your actual home directory (`echo $HOME` in a terminal).

On Linux, the path is `/home/YOUR_USERNAME/...`.

### Windows

```json
{
  "mcpServers": {
    "agentone-token-compression": {
      "command": "node",
      "args": [
        "C:\\Users\\YOUR_USERNAME\\.claude\\plugins\\agentone-token-compression\\mcp-server\\index.js"
      ]
    }
  }
}
```

Double-backslash the path separators in JSON.

### If you already have other MCP servers

Just add `agentone-token-compression` to the existing block — it's additive:

```json
{
  "mcpServers": {
    "filesystem": { "command": "...", "args": ["..."] },
    "agentone-token-compression": {
      "command": "node",
      "args": ["/Users/YOU/.claude/plugins/agentone-token-compression/mcp-server/index.js"]
    }
  }
}
```

## Step 3 — Restart Claude Desktop

**Fully quit** Claude Desktop (not just close the window — use Cmd-Q on macOS or right-click the tray icon → Quit on Windows/Linux), then relaunch.

Claude reads `claude_desktop_config.json` only at startup.

## Step 4 — Verify

After restart, look at the bottom of any Claude Desktop conversation. You should see a 🔌 connector icon. Click it; `agentone-token-compression` should be listed with 5 tools:

- `compress` — compress arbitrary text
- `analyze` — detect type + estimate savings without modifying
- `stats` — lifetime savings + $ saved
- `optimize` — analyze stats + recommend/apply config changes
- `clear_cache` — reset caches or stats

Then try a quick test prompt:

> Use the AgentOne `analyze` tool on this JSON: `{"items":[1,2,3,4,5],"meta":null}`

Claude should call the `analyze` tool and report the detected type, token count, and recommendation.

Another:

> Use the `stats` tool to show me my token savings so far.

And:

> Use the AgentOne `optimize` tool to find ways I could save more tokens. Apply the HIGH-impact recommendations automatically.

## How Claude knows to use the tools

The bundled skill `agentone-token-compression` describes the use cases:
- User pastes 1000+ chars of JSON / logs / code / file content
- User mentions tokens, cost, context, compression
- Before forwarding large content to a sub-agent

Claude reads the skill's description and proactively calls the tools when those conditions match. You can also ask explicitly: *"Compress this file before we discuss it"*, *"How many tokens would this save?"*, *"Show me my AgentOne stats"*.

## Optional — set environment variables

You can pass env vars to the MCP server (e.g. to point at a different cache directory):

```json
{
  "mcpServers": {
    "agentone-token-compression": {
      "command": "node",
      "args": ["/Users/YOU/.claude/plugins/agentone-token-compression/mcp-server/index.js"],
      "env": {
        "TOKEN_OPTIMIZER_DATA_DIR": "/Users/YOU/Documents/agentone-cache"
      }
    }
  }
}
```

Available variables:

- `TOKEN_OPTIMIZER_DATA_DIR` — where to store caches & stats (default: `~/.claude/plugins/agentone-token-compression/data`)
- `TOKEN_OPTIMIZER_DISABLED=1` — soft-disable the server (it still loads but every tool returns "disabled")

## Troubleshooting

### "Tool list is empty in the connector menu"
Claude Desktop didn't manage to start the server. Check:
1. Run the path manually: `node /Users/YOU/.claude/plugins/agentone-token-compression/mcp-server/index.js` — should print `[AgentOne Token Compression MCP server ready · v1.0.0 …]` to stderr and wait. Press Ctrl-C.
2. Make sure `node` is on `PATH` for Claude Desktop. On macOS, GUI apps sometimes have a minimal PATH; use the full path to node, e.g. `"command": "/opt/homebrew/bin/node"` or `"command": "/usr/local/bin/node"`.
3. Check Claude Desktop's logs (Help → Troubleshooting → Open Logs).

### "tool call failed: ENOENT"
The path in `args` is wrong. Verify with `ls -la /path/to/.claude/plugins/agentone-token-compression/mcp-server/index.js`.

### "JSON parse error" in Desktop logs
Make sure your `claude_desktop_config.json` is valid JSON. Run it through `python -m json.tool < claude_desktop_config.json` to check.

### Server starts but Claude never uses it
Ask explicitly: *"Use the agentone-token-compression `compress` tool to compress the following content."* If Claude can call it that way, the skill triggers just need more obvious cues — that's a tuning issue, not a setup one.

## Using both Claude Code AND Claude Desktop

Yes — they coexist cleanly. The Claude Code hooks and the Desktop MCP server share the same cache and stats file at `~/.claude/plugins/agentone-token-compression/data/`. Your `/tokens` view (Code) and the MCP `stats` tool (Desktop) show the same numbers.

## Uninstalling on Desktop

Remove the `agentone-token-compression` entry from your `claude_desktop_config.json` and restart Claude Desktop. To remove the files too:

```bash
bash ~/.claude/plugins/agentone-token-compression/scripts/uninstall.sh
```
