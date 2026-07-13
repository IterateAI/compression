# Distribution Guide

AgentOne Token Compression supports **three install paths**. Pick whichever fits your environment.

## Comparison

| Path | Audience | Pros | Cons |
|---|---|---|---|
| **A. npm package** (recommended) | Most users | Cross-platform, versioned, one command, no clone | Need Node + npm on PATH |
| **B. Claude Code marketplace** | Claude Code users | Native plugin manager UX inside Claude Code | Pulls source from Git |
| **C. Source clone** | Contributors | Edit + reload | Requires bash + git |
| **D. Release tarball** | Air-gapped environments | One download, no Git | Manual download flow |

---

## A. npm package (recommended)

We publish to npm under **`@iterate/agentone-token-compression`**. The package is a self-contained bundle (the optimizer engine is inlined via esbuild — no separate dependency to manage).

### Claude Code + CLI

```bash
# Install globally so `agentone-tc` is on PATH
npm install -g @iterate/agentone-token-compression

# Run the bundled installer (sets up ~/.claude hooks, commands, skill)
agentone-tc install

# Verify
agentone-tc doctor

# Then restart Claude Code
```

### Claude Desktop

The MCP server entry point is the same package; no separate install. Just add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentone-token-compression": {
      "command": "npx",
      "args": ["-y", "@iterate/agentone-token-compression", "mcp"]
    }
  }
}
```

`npx -y` auto-fetches the latest version on first run, then uses the cached install. No system-wide install needed for Desktop alone.

To get a ready-to-paste snippet for your OS:

```bash
agentone-tc desktop
```

### Updates

```bash
npm update -g @iterate/agentone-token-compression
agentone-tc install   # re-run to pick up any new commands/skills
```

Caches and stats persist across updates.

### Package contents

The npm tarball is **~123 KB** (compressed) / **~520 KB** (unpacked) containing 31 files:
- Bundled hooks (4 files), bundled MCP server, bundled CLI, bundled stat/compress scripts
- Slash command markdown files
- Skill markdown file
- Docs (README, INSTALL, INSTALL_DESKTOP, DISTRIBUTION, CHANGELOG)
- Example config templates for all three OSes

Zero runtime dependencies. Just Node 18+.

---

## B. Claude Code plugin marketplace

Claude Code has a built-in plugin manager that reads `marketplace.json` from a Git URL. We ship one. To install:

```
/plugin marketplace add https://github.com/IterateAI/compression
/plugin install agentone-token-compression@iterate-ai-marketplace
```

The marketplace flow pulls the Git repo and wires up the plugin. This path doesn't have an MCP shortcut — for Claude Desktop, still use the npm path (Section A).

---

## C. Source clone (developers / contributors)

```bash
git clone https://github.com/IterateAI/compression
cd agentone-token-compression/claude_plugin

# Install local symlink to the engine
npm install --no-save

# Wire up Claude
bash scripts/install.sh
```

Edit source files in `hooks/`, `mcp-server/`, `lib/`, etc., then restart Claude Code to pick up changes. Run `node build/build.js` to produce the bundled `dist/` artifacts.

### Running tests

```bash
node --test test/hooks.test.js test/mcp.test.js test/suggestion.test.js
node test/benchmark.js
```

---

## D. Release tarball (air-gapped / offline)

For environments that can't reach npm or GitHub:

1. Download the latest release from `https://github.com/IterateAI/compression/releases/latest`
   → file: `agentone-token-compression-1.x.x.tgz`
2. Extract: `tar -xzf agentone-token-compression-1.x.x.tgz`
3. From the extracted `package/` directory:
   ```bash
   node cli/agentone-tc.js install
   ```

The tarball is the same bundle as the npm package — fully self-contained.

---

## Why npm and not standalone binaries?

We considered shipping per-platform binaries via Node SEA (Single Executable App). We chose npm because:

1. **The algorithms are not secrets.** Mask-union, abbreviation rules, semantic cache — all published openly. Binary distribution would only protect ~5 KB of glue code.
2. **Three binaries × ~80 MB each** vs **one 123 KB tarball** is a worse user experience.
3. **Updates with npm are one command.** Binaries require re-downloading the right OS-arch combo every release.
4. **JavaScript shipped to user machines is always readable**, no matter how bundled or minified. The honest answer is to embrace open-source.

If you have a strict policy requiring binaries, we can publish Node SEA builds on request — file an issue.

---

## Publishing (for maintainers)

```bash
cd claude_plugin

# 1. Bump version in package.json
# 2. Update CHANGELOG.md
# 3. Build the bundled artifact
npm run build:minify

# 4. Verify what would be published
cd dist && npm pack --dry-run

# 5. Publish (from the dist/ directory)
npm publish --access public

# 6. Tag the release
git tag v1.x.x && git push --tags
```

`prepublishOnly` runs the test suite — publish is blocked on failures.

---

## Verifying a fresh install

After any install path, run:

```bash
agentone-tc doctor
```

Expected output:
```
✓ Node version >= 18
✓ Claude dir exists
✓ Plugin installed
✓ Hook file: compress-tool-output.js
✓ MCP server file
✓ settings.json exists
✓ PostToolUse hook wired
✓ Slash commands installed
✓ Hook executes without error

All 9 checks passed. You're good.
```

If any check fails, the doctor will tell you exactly what to do (usually `agentone-tc install`).
