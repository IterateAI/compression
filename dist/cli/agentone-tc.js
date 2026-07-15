#!/usr/bin/env node
/* Copyright (c) 2026 Iterate.ai. All rights reserved. Authors: Brian Sathianathan, Arul Chanderasekeran — assisted by Claude. */
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// package.json
var require_package = __commonJS({
  "package.json"(exports2, module2) {
    module2.exports = {
      name: "@iterate.ai/agentone-token-compression",
      version: "1.1.12",
      description: "AgentOne Token Compression by Iterate.ai. One npm install gives you 40\u201390% token savings in Claude Code, Claude CLI, and Claude Desktop. Compresses tool outputs, prompts, file reads, and conversation context. Mask-union architecture protects API keys, UUIDs, and high-entropy content by construction.",
      keywords: [
        "agentone",
        "iterate-ai",
        "claude-code",
        "claude-cli",
        "claude-desktop",
        "claude-plugin",
        "mcp",
        "model-context-protocol",
        "token-optimization",
        "compression",
        "cost-savings",
        "context-management",
        "semantic-cache"
      ],
      homepage: "https://iterate.ai/agentone",
      repository: {
        type: "git",
        url: "https://github.com/IterateAI/compression"
      },
      bugs: {
        url: "https://github.com/IterateAI/compression/issues"
      },
      license: "LicenseRef-Iterate-AgentOne",
      author: "Iterate.ai",
      main: "./cli/agentone-tc.js",
      bin: {
        "agentone-tc": "./cli/agentone-tc.js",
        "agentone-token-compression": "./cli/agentone-tc.js"
      },
      files: [
        "cli/",
        "hooks/",
        "mcp-server/",
        "scripts/",
        "commands/",
        "skills/",
        "lib/",
        "examples/",
        "settings.json",
        "plugin.json",
        "README.md",
        "INSTALL.md",
        "INSTALL_DESKTOP.md",
        "DISTRIBUTION.md",
        "CHANGELOG.md",
        "LICENSE"
      ],
      scripts: {
        test: "node --test test/*.test.js",
        benchmark: "node test/benchmark.js",
        build: "node build/build.js",
        "build:minify": "node build/build.js --minify",
        "build:protect": "node build/build.js --protect",
        mcp: "node dist/mcp-server/index.js",
        prepublishOnly: "npm test"
      },
      dependencies: {
        "@iterate/token-optimizer": "file:../nodejs_optimizer"
      },
      devDependencies: {
        esbuild: "^0.24.2",
        "javascript-obfuscator": "^5.4.7"
      },
      engines: {
        node: ">=18.0.0"
      },
      publishConfig: {
        access: "public"
      }
    };
  }
});

// cli/agentone-tc.js
var fs = require("node:fs");
var path = require("node:path");
var os = require("node:os");
var VERSION = require_package().version || "1.1.0";
var PKG_NAME = "agentone-token-compression";
function claudeDir() {
  return process.env.CLAUDE_DIR || path.join(os.homedir(), ".claude");
}
function pluginDir() {
  return path.join(claudeDir(), "plugins", PKG_NAME);
}
function commandsDir() {
  return path.join(claudeDir(), "commands");
}
function skillsDir() {
  return path.join(claudeDir(), "skills");
}
function settingsFile() {
  return path.join(claudeDir(), "settings.json");
}
function packageRoot() {
  return path.resolve(__dirname, "..");
}
function desktopRoot() {
  if (process.env.CLAUDE_DESKTOP_DIR) return process.env.CLAUDE_DESKTOP_DIR;
  switch (process.platform) {
    case "darwin":
      return path.join(os.homedir(), "Library", "Application Support", "Claude");
    case "win32":
      return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Claude");
    default:
      return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "Claude");
  }
}
function desktopConfigPath() {
  return path.join(desktopRoot(), "claude_desktop_config.json");
}
function desktopSkillsDir() {
  return path.join(desktopRoot(), "skills");
}
function buildMcpServerEntry(flags) {
  if (flags.command) {
    return {
      command: flags.command,
      args: Array.isArray(flags.args) ? flags.args : flags.args ? [flags.args] : []
    };
  }
  if (flags["use-npx"] || flags.npx) {
    return {
      command: "npx",
      args: ["-y", "@iterate/agentone-token-compression", "mcp"]
    };
  }
  const candidates = [
    path.join(packageRoot(), "mcp-server", "index.js"),
    path.join(packageRoot(), "dist", "mcp-server", "index.js")
  ];
  const server = candidates.find((p) => fs.existsSync(p));
  if (!server) {
    throw new Error(
      "Could not locate mcp-server/index.js. Either run `agentone-tc install` first or pass --use-npx (after publishing) or --command <path>."
    );
  }
  return {
    command: "node",
    args: [server]
  };
}
function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq >= 0) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next === void 0 || next.startsWith("--")) {
        out[a.slice(2)] = true;
      } else {
        out[a.slice(2)] = next;
        i++;
      }
    }
  }
  return out;
}
var isTTY = process.stdout.isTTY;
var c = {
  cyan: (s) => isTTY ? `\x1B[36m${s}\x1B[0m` : s,
  green: (s) => isTTY ? `\x1B[32m${s}\x1B[0m` : s,
  yellow: (s) => isTTY ? `\x1B[33m${s}\x1B[0m` : s,
  red: (s) => isTTY ? `\x1B[31m${s}\x1B[0m` : s,
  bold: (s) => isTTY ? `\x1B[1m${s}\x1B[0m` : s,
  dim: (s) => isTTY ? `\x1B[2m${s}\x1B[0m` : s
};
function log(...args2) {
  console.log(...args2);
}
function err(...args2) {
  console.error(...args2);
}
function cmdHelp() {
  log(`
${c.cyan(c.bold("AgentOne Token Compression"))} ${c.dim("v" + VERSION)} by Iterate.ai

Usage:  ${c.bold("agentone-tc")} ${c.dim("<command> [options]")}

Commands:
  ${c.green("install")}              Set up hooks, commands, skill in ~/.claude (Claude Code + CLI)
  ${c.green("install-desktop")}      Auto-install into Claude Desktop (config + skill)
  ${c.green("uninstall")}            Remove from ~/.claude
  ${c.green("uninstall-desktop")}    Remove from Claude Desktop
  ${c.green("mcp")}                  Start the MCP server (used by Claude Desktop)
  ${c.green("desktop")}              Print the claude_desktop_config.json snippet to add
  ${c.green("doctor")}               Verify both installs + diagnostics
  ${c.green("stats")}                Show lifetime token savings
  ${c.green("version")}              Print version
  ${c.green("help")}                 This message

install-desktop flags:
  --use-npx                   Reference the published npm package (npx -y \u2026mcp)
  --command <path>            Override the command (advanced)
  --args <a> <b> ...          Override args when using --command

Environment:
  CLAUDE_DIR                  Override ~/.claude (default: $HOME/.claude)
  CLAUDE_DESKTOP_DIR          Override Claude Desktop data dir (testing)
  TOKEN_OPTIMIZER_DATA_DIR    Override cache/stats directory
  TOKEN_OPTIMIZER_DISABLED=1  Soft-disable hooks without uninstalling

Common flows:

  ${c.dim("# Install for Claude Code & CLI")}
  npm install -g @iterate/${PKG_NAME}
  agentone-tc install

  ${c.dim("# Auto-install for Claude Desktop")}
  agentone-tc install-desktop
  ${c.dim("# (then fully quit & relaunch Claude Desktop)")}

  ${c.dim("# Check it works")}
  agentone-tc doctor
`);
}
function cmdVersion() {
  log(VERSION);
}
function cmdMcp() {
  const candidates = [
    path.join(packageRoot(), "mcp-server", "index.js"),
    path.join(packageRoot(), "dist", "mcp-server", "index.js")
  ];
  const server = candidates.find((p) => fs.existsSync(p));
  if (!server) {
    err(c.red(`\u2717 MCP server file not found. Looked in: ${candidates.join(", ")}`));
    process.exit(1);
  }
  require(server);
}
function cmdDesktop() {
  const platform = process.platform;
  const configPath = platform === "darwin" ? "~/Library/Application Support/Claude/claude_desktop_config.json" : platform === "win32" ? "%APPDATA%\\Claude\\claude_desktop_config.json" : "~/.config/Claude/claude_desktop_config.json";
  log(`
${c.cyan(c.bold("AgentOne Token Compression \u2014 Claude Desktop setup"))}

1. Open: ${c.bold(configPath)}
2. Add to the ${c.green('"mcpServers"')} block (create if missing):
`);
  log(c.dim("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
  console.log(JSON.stringify({
    mcpServers: {
      [PKG_NAME]: {
        command: "npx",
        args: ["-y", `@iterate/${PKG_NAME}`, "mcp"]
      }
    }
  }, null, 2));
  log(c.dim("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
  log(`
3. ${c.bold("Fully quit")} Claude Desktop (Cmd-Q on macOS) and relaunch.
4. Look for the \u{1F50C} connector icon at the bottom \u2014 should list ${c.green(PKG_NAME)}
   with 5 tools: compress, analyze, stats, clear_cache, optimize.

That's it. Claude will call the tools when relevant; you can also ask explicitly:
  ${c.dim('"Use the AgentOne optimize tool to find token savings."')}
`);
}
function safeReadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function atomicWriteJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}
function copyTree(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}
function cmdInstall() {
  const banner = [
    "\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E",
    "\u2502   AgentOne Token Compression by Iterate.ai      \u2502",
    "\u2502   Cut your Claude token bill 40-90%.            \u2502",
    "\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F"
  ].join("\n");
  log(c.cyan(banner));
  const major = parseInt(process.versions.node.split(".")[0], 10);
  if (major < 18) {
    err(c.red(`\u2717 Node 18+ required (you have ${process.version}).`));
    process.exit(1);
  }
  log(c.green(`\u2713 Node ${process.version}`));
  log(c.green(`\u2713 Platform ${process.platform} ${process.arch}`));
  fs.mkdirSync(claudeDir(), { recursive: true });
  log(c.cyan("\n[1/4] Copying plugin files\u2026"));
  const ROOT = packageRoot();
  const useDistLayout = fs.existsSync(path.join(ROOT, "hooks", "compress-tool-output.js"));
  fs.mkdirSync(pluginDir(), { recursive: true });
  for (const sub2 of ["dist", "hooks", "mcp-server", "scripts", "commands", "skills", "examples", "lib"]) {
    const from = path.join(ROOT, sub2);
    if (fs.existsSync(from)) {
      const to = path.join(pluginDir(), sub2);
      fs.rmSync(to, { recursive: true, force: true });
      copyTree(from, to);
    }
  }
  for (const f of ["settings.json", "plugin.json", "README.md", "INSTALL.md", "INSTALL_DESKTOP.md", "CHANGELOG.md", "LICENSE", "package.json"]) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(pluginDir(), f));
  }
  log(c.green(`  \u2192 ${pluginDir()}`));
  log(c.cyan("\n[2/4] Installing slash commands\u2026"));
  const cmdSrc = path.join(pluginDir(), "commands");
  if (fs.existsSync(cmdSrc)) {
    fs.mkdirSync(commandsDir(), { recursive: true });
    for (const f of fs.readdirSync(cmdSrc)) {
      if (!f.endsWith(".md")) continue;
      const src = path.join(cmdSrc, f);
      const dst = path.join(commandsDir(), f);
      if (fs.existsSync(dst)) {
        try {
          const same = fs.readFileSync(src, "utf8") === fs.readFileSync(dst, "utf8");
          if (!same) fs.copyFileSync(dst, dst + ".bak");
        } catch {
        }
      }
      fs.copyFileSync(src, dst);
      log(c.green(`  \u2192 /${path.basename(f, ".md")}`));
    }
  }
  log(c.cyan("\n[3/4] Installing skill\u2026"));
  const skillFrom = path.join(pluginDir(), "skills", PKG_NAME, "SKILL.md");
  if (fs.existsSync(skillFrom)) {
    const skillTo = path.join(skillsDir(), PKG_NAME, "SKILL.md");
    fs.mkdirSync(path.dirname(skillTo), { recursive: true });
    fs.copyFileSync(skillFrom, skillTo);
    log(c.green(`  \u2192 ${path.dirname(skillTo)}`));
  }
  log(c.cyan("\n[4/4] Wiring hooks into settings.json\u2026"));
  const ourSettings = safeReadJson(path.join(pluginDir(), "settings.json"), {});
  delete ourSettings._comment;
  delete ourSettings["$schema"];
  let current = safeReadJson(settingsFile(), {});
  current.hooks = current.hooks || {};
  for (const event of Object.keys(ourSettings.hooks || {})) {
    current.hooks[event] = current.hooks[event] || [];
    const already = current.hooks[event].some(
      (b) => JSON.stringify(b).includes(PKG_NAME) || JSON.stringify(b).includes("token-optimizer")
    );
    if (!already) {
      current.hooks[event].push(...ourSettings.hooks[event]);
    }
  }
  if (!current.statusLine && ourSettings.statusLine) {
    current.statusLine = ourSettings.statusLine;
  }
  atomicWriteJson(settingsFile(), current);
  log(c.green(`  \u2192 ${settingsFile()}`));
  log("");
  log(c.green("\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E"));
  log(c.green("\u2502   \u2713  Installed!                                 \u2502"));
  log(c.green("\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F"));
  log(`
Next steps:
  1. ${c.bold("Restart Claude Code")} (or start a new session)
  2. Try a slash command:  ${c.bold("/optimize_dashboard")}
  3. For ${c.bold("Claude Desktop")}, run: ${c.bold("agentone-tc install-desktop")}

Configuration:    ${pluginDir()}/data/config.json
Disable:          ${c.dim("export TOKEN_OPTIMIZER_DISABLED=1")}
Uninstall:        ${c.dim("agentone-tc uninstall")}
`);
}
function cmdInstallDesktop() {
  const flags = parseFlags(process.argv.slice(3));
  log(c.cyan(c.bold("AgentOne Token Compression \u2014 Claude Desktop install\n")));
  const configPath = desktopConfigPath();
  const skillsDir2 = desktopSkillsDir();
  log(`Platform:   ${process.platform}`);
  log(`Config:     ${configPath}`);
  log(`Skills:     ${skillsDir2}`);
  log("");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.mkdirSync(skillsDir2, { recursive: true });
  let entry;
  try {
    entry = buildMcpServerEntry(flags);
  } catch (e) {
    err(c.red("\u2717 " + e.message));
    process.exit(1);
  }
  log(c.cyan("[1/2] Wiring MCP server into claude_desktop_config.json\u2026"));
  let config = safeReadJson(configPath, {});
  if (!config.mcpServers || typeof config.mcpServers !== "object") config.mcpServers = {};
  const existing = config.mcpServers[PKG_NAME];
  if (existing && JSON.stringify(existing) !== JSON.stringify(entry)) {
    const bak = configPath + ".bak." + Date.now();
    fs.copyFileSync(configPath, bak);
    log(c.yellow(`  ! existing ${PKG_NAME} entry replaced \u2014 backed up to ${bak}`));
  }
  config.mcpServers[PKG_NAME] = entry;
  atomicWriteJson(configPath, config);
  log(c.green(`  \u2192 ${configPath}`));
  log(c.dim(`    command: ${entry.command} ${(entry.args || []).join(" ")}`));
  log(c.cyan("\n[2/2] Installing skill\u2026"));
  const skillSrc = path.join(packageRoot(), "skills", PKG_NAME, "SKILL.md");
  if (fs.existsSync(skillSrc)) {
    const skillDst = path.join(skillsDir2, PKG_NAME, "SKILL.md");
    fs.mkdirSync(path.dirname(skillDst), { recursive: true });
    fs.copyFileSync(skillSrc, skillDst);
    log(c.green(`  \u2192 ${path.dirname(skillDst)}`));
  } else {
    log(c.yellow(`  ! SKILL.md not found at ${skillSrc} \u2014 skipping (you'll need to add via UI)`));
  }
  log("");
  log(c.green("\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E"));
  log(c.green("\u2502   \u2713  Installed in Claude Desktop                \u2502"));
  log(c.green("\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F"));
  log(`
Next steps:
  1. ${c.bold("Fully quit Claude Desktop")} (Cmd-Q on macOS, right-click tray \u2192 Quit on Windows/Linux)
  2. Relaunch Claude Desktop
  3. Look for the \u{1F50C} connector icon at the bottom of any conversation \u2014 should list:
     ${c.green(PKG_NAME)} (5 tools: compress, analyze, stats, optimize, clear_cache)

Quick test prompt:
  ${c.dim('"Use the AgentOne analyze tool on this JSON: {\\"a\\":1,\\"b\\":[1,2,3]}"')}

Roll back:
  ${c.dim("agentone-tc uninstall-desktop")}
`);
}
function cmdUninstallDesktop() {
  log(c.cyan("Uninstalling AgentOne from Claude Desktop\u2026"));
  const configPath = desktopConfigPath();
  const skillsDir2 = desktopSkillsDir();
  if (fs.existsSync(configPath)) {
    const config = safeReadJson(configPath, {});
    let removed = false;
    if (config.mcpServers && config.mcpServers[PKG_NAME]) {
      delete config.mcpServers[PKG_NAME];
      removed = true;
    }
    if (config.mcpServers && config.mcpServers["token-optimizer"]) {
      delete config.mcpServers["token-optimizer"];
      removed = true;
    }
    if (config.mcpServers && Object.keys(config.mcpServers).length === 0) delete config.mcpServers;
    if (removed) {
      atomicWriteJson(configPath, config);
      log(c.green(`  removed mcpServers["${PKG_NAME}"] from ${configPath}`));
    } else {
      log(c.dim(`  no MCP entry to remove from ${configPath}`));
    }
  }
  const skillDir = path.join(skillsDir2, PKG_NAME);
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true });
    log(c.green(`  removed ${skillDir}`));
  }
  log(c.green("\nDone. Fully quit and relaunch Claude Desktop for changes to take effect."));
}
function cmdUninstall() {
  log(c.cyan("Uninstalling AgentOne Token Compression\u2026"));
  if (fs.existsSync(pluginDir())) {
    fs.rmSync(pluginDir(), { recursive: true, force: true });
    log(c.green(`  removed ${pluginDir()}`));
  }
  const cmdNames = ["tokens.md", "compress.md", "tokens-config.md", "tokens-reset.md", "tokens-off.md", "tokens-on.md", "optimize.md", "optimize_dashboard.md", "compression.md"];
  for (const name of cmdNames) {
    const f = path.join(commandsDir(), name);
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      log(c.green(`  removed ${f}`));
    }
  }
  const skill = path.join(skillsDir(), PKG_NAME);
  if (fs.existsSync(skill)) {
    fs.rmSync(skill, { recursive: true, force: true });
    log(c.green(`  removed ${skill}`));
  }
  const legacy = path.join(skillsDir(), "token-optimizer");
  if (fs.existsSync(legacy)) {
    fs.rmSync(legacy, { recursive: true, force: true });
  }
  if (fs.existsSync(settingsFile())) {
    const s = safeReadJson(settingsFile(), {});
    if (s.hooks) {
      for (const event of Object.keys(s.hooks)) {
        s.hooks[event] = (s.hooks[event] || []).filter((b) => {
          const j = JSON.stringify(b);
          return !j.includes(PKG_NAME) && !j.includes("token-optimizer");
        });
        if (s.hooks[event].length === 0) delete s.hooks[event];
      }
      if (Object.keys(s.hooks).length === 0) delete s.hooks;
    }
    if (s.statusLine && s.statusLine.command && (s.statusLine.command.includes(PKG_NAME) || s.statusLine.command.includes("token-optimizer"))) {
      delete s.statusLine;
    }
    atomicWriteJson(settingsFile(), s);
    log(c.green(`  cleaned hooks from ${settingsFile()}`));
  }
  log(c.green("\nDone. Restart Claude Code for changes to take effect."));
  log(c.dim(`
Note: cached data preserved at ${pluginDir()}/data (if you reinstall, savings resume).`));
  log(c.dim("Delete that directory manually for a fully clean uninstall."));
}
function cmdDoctor() {
  log(c.cyan(c.bold("AgentOne Token Compression \u2014 diagnostics\n")));
  const checks = [];
  function check(label, ok, detail) {
    checks.push({ label, ok, detail });
    log(`  ${ok ? c.green("\u2713") : c.red("\u2717")} ${label.padEnd(40)} ${c.dim(detail || "")}`);
  }
  check(
    "Node version >= 18",
    parseInt(process.versions.node.split(".")[0], 10) >= 18,
    process.version
  );
  check("Claude dir exists", fs.existsSync(claudeDir()), claudeDir());
  check("Plugin installed", fs.existsSync(pluginDir()), pluginDir());
  const runtimeHook = path.join(pluginDir(), "dist", "hooks", "compress-tool-output.js");
  check("Runtime hook bundle: dist/hooks/compress-tool-output.js", fs.existsSync(runtimeHook));
  let selfContained = false;
  try {
    const src = fs.readFileSync(runtimeHook, "utf8");
    selfContained = src.includes("CompressionGovernor") && !/require\(['"]@iterate\/token-optimizer['"]\)/.test(src);
  } catch {
  }
  check(
    "Runtime bundle is self-contained (library inlined, current IP)",
    selfContained,
    selfContained ? "ok" : "run `npm run build` then `agentone-tc install`"
  );
  check("MCP server bundle", fs.existsSync(path.join(pluginDir(), "dist", "mcp-server", "index.js")));
  check("settings.json exists", fs.existsSync(settingsFile()), settingsFile());
  const sJson = safeReadJson(settingsFile(), {});
  const hasPostToolUseHook = sJson.hooks?.PostToolUse?.some(
    (b) => JSON.stringify(b).includes(PKG_NAME) || JSON.stringify(b).includes("token-optimizer")
  );
  check(
    "PostToolUse hook wired",
    !!hasPostToolUseHook,
    hasPostToolUseHook ? "found in settings.json" : "run `agentone-tc install`"
  );
  const cmdOk = fs.existsSync(path.join(commandsDir(), "optimize_dashboard.md"));
  check("Slash commands installed", cmdOk, commandsDir());
  try {
    const { spawnSync } = require("node:child_process");
    const hookPath = path.join(pluginDir(), "dist", "hooks", "compress-tool-output.js");
    if (fs.existsSync(hookPath)) {
      const res = spawnSync("node", [hookPath], {
        input: JSON.stringify({ tool_name: "Read", tool_response: { file_text: "hi" } }),
        timeout: 5e3
      });
      check("Hook executes without error", res.status === 0, "response: " + (res.stdout?.toString().slice(0, 80) || ""));
    }
  } catch (e) {
    check("Hook executes", false, e.message);
  }
  log(c.dim("\n  --- Claude Desktop ---"));
  const dCfg = desktopConfigPath();
  const dCfgExists = fs.existsSync(dCfg);
  check("Desktop config exists", dCfgExists, dCfg);
  const dConfig = dCfgExists ? safeReadJson(dCfg, {}) : {};
  const desktopEntry = dConfig?.mcpServers?.[PKG_NAME];
  check(
    "Desktop MCP server wired",
    !!desktopEntry,
    desktopEntry ? `${desktopEntry.command} ${(desktopEntry.args || []).join(" ").slice(0, 60)}` : "run `agentone-tc install-desktop`"
  );
  const dSkill = path.join(desktopSkillsDir(), PKG_NAME, "SKILL.md");
  check("Desktop skill present", fs.existsSync(dSkill), dSkill);
  const failed = checks.filter((x) => !x.ok).length;
  log("");
  if (failed === 0) log(c.green(c.bold(`All ${checks.length} checks passed. You're good.`)));
  else log(c.yellow(c.bold(`${failed} of ${checks.length} checks failed. Run \`agentone-tc install\` and/or \`agentone-tc install-desktop\` to fix.`)));
}
function cmdStats() {
  const statsScript = path.join(pluginDir(), "scripts", "print-stats.js");
  if (!fs.existsSync(statsScript)) {
    err(c.red("\u2717 stats script not found. Run `agentone-tc install` first."));
    process.exit(1);
  }
  require(statsScript);
}
var args = process.argv.slice(2);
var sub = (args[0] || "help").toLowerCase();
var handlers = {
  install: cmdInstall,
  uninstall: cmdUninstall,
  "install-desktop": cmdInstallDesktop,
  "uninstall-desktop": cmdUninstallDesktop,
  mcp: cmdMcp,
  desktop: cmdDesktop,
  doctor: cmdDoctor,
  stats: cmdStats,
  help: cmdHelp,
  "--help": cmdHelp,
  "-h": cmdHelp,
  version: cmdVersion,
  "--version": cmdVersion,
  "-v": cmdVersion
};
var fn = handlers[sub];
if (!fn) {
  err(c.red(`Unknown command: ${sub}`));
  cmdHelp();
  process.exit(2);
}
try {
  fn();
} catch (e) {
  err(c.red("\u2717 " + (e?.message || String(e))));
  if (process.env.DEBUG) err(e?.stack);
  process.exit(1);
}
