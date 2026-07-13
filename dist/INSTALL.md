# Installation Guide

## Prerequisites

- **Node.js 18 or newer** — check with `node --version`
- **Claude Code installed** — `~/.claude/` directory should exist
- No npm install needed; the optimizer engine is bundled

## Quick install (recommended)

```bash
git clone https://github.com/iterate-ai/token-optimizer
cd token-optimizer/claude_plugin
bash scripts/install.sh
```

Then **restart Claude Code** (or open a new session).

The installer is idempotent — running it again is safe and will overwrite older files.

## Manual install (advanced)

If you'd rather control the install yourself:

1. Copy the plugin somewhere stable:
   ```bash
   cp -R claude_plugin ~/.claude/plugins/agentone-token-compression
   ```

2. Make the optimizer engine resolvable. Either:
   - Symlink: `ln -sfn /path/to/nodejs_optimizer ~/.claude/plugins/agentone-token-compression/node_modules/@iterate/token-optimizer`
   - Or run `npm install` inside the plugin dir if you have a published version.

3. Copy the slash commands:
   ```bash
   cp ~/.claude/plugins/agentone-token-compression/commands/*.md ~/.claude/commands/
   ```

4. Copy the skill:
   ```bash
   mkdir -p ~/.claude/skills/agentone-token-compression
   cp ~/.claude/plugins/agentone-token-compression/skills/agentone-token-compression/SKILL.md ~/.claude/skills/agentone-token-compression/
   ```

5. Merge the hooks into your `~/.claude/settings.json`. The file `~/.claude/plugins/agentone-token-compression/settings.json` has the exact block. Manually:

   ```json
   {
     "hooks": {
       "PostToolUse": [
         {
           "matcher": "Read|Grep|Glob|Bash|WebFetch|NotebookRead",
           "hooks": [{ "type": "command", "command": "node $HOME/.claude/plugins/agentone-token-compression/hooks/compress-tool-output.js" }]
         }
       ],
       "UserPromptSubmit": [
         {
           "hooks": [{ "type": "command", "command": "node $HOME/.claude/plugins/agentone-token-compression/hooks/compress-prompt.js" }]
         }
       ],
       "SessionEnd": [
         {
           "hooks": [{ "type": "command", "command": "node $HOME/.claude/plugins/agentone-token-compression/hooks/session-end.js" }]
         }
       ]
     },
     "statusLine": {
       "type": "command",
       "command": "node $HOME/.claude/plugins/agentone-token-compression/hooks/statusline.js"
     }
   }
   ```

6. Restart Claude Code.

## Verifying installation

After restart, in a Claude Code session:

```
/tokens
```

You should see a stats panel. After a few file reads or bash commands:

```
/tokens
```

…shows accumulated savings.

## Selecting which tools to compress

By default we hook `Read|Grep|Glob|Bash|WebFetch|NotebookRead`. To restrict, edit the `matcher` field in `~/.claude/settings.json`. For example, only Read and Grep:

```json
"matcher": "Read|Grep"
```

## Per-project settings

Put a `.claude/settings.json` in your project root to override globally. The plugin's hooks will still fire — just the matcher / config changes per project.

## Disabling

**Temporarily for one shell:**
```bash
export TOKEN_OPTIMIZER_DISABLED=1
```

**Permanently:**
```bash
bash ~/.claude/plugins/agentone-token-compression/scripts/uninstall.sh
```

## Updating

```bash
cd token-optimizer
git pull
bash claude_plugin/scripts/install.sh
```

Caches and stats are preserved across updates.

## Troubleshooting

### `node: command not found` during install
Install Node.js 18+ from https://nodejs.org or your package manager.

### Hooks don't fire
- Verify Claude Code reloads the settings on session start (it does). Restart Claude Code.
- Verify your `~/.claude/settings.json` has the `hooks` block from above.
- Check that the file paths exist: `ls ~/.claude/plugins/agentone-token-compression/hooks/`.

### `cannot find module '@iterate/token-optimizer'`
Re-run `install.sh` from the cloned repo — it bundles the engine. If you're testing from the source repo, ensure `nodejs_optimizer` is alongside `claude_plugin` so the symlink works.

### Slow hooks
Run `time (echo '{}' | node ~/.claude/plugins/agentone-token-compression/hooks/compress-tool-output.js)` — should be under 100ms. If not, your Node startup is slow; consider using a Node version manager (nvm/fnm) for a fast Node 20+.

### Existing hooks in settings.json
The installer is additive — it appends to existing arrays without clobbering. If something looks off, restore from the backup `~/.claude/settings.json.bak.<timestamp>` the installer creates.
