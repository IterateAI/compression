#!/usr/bin/env node
/* Copyright (c) 2026 Iterate.ai. All rights reserved. Authors: Brian Sathianathan, Arul Chanderasekeran — assisted by Claude. */
"use strict";

// scripts/set-statusline.js
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var MARKER = "agentone-token-compression";
var STATUSLINE_CMD = 'node "$(ls -d $HOME/.claude/plugins/cache/iterate-ai/agentone-token-compression/*/dist/hooks/statusline.js | sort -V | tail -1)"';
var file = path.join(os.homedir(), ".claude", "settings.json");
var arg = (process.argv[2] || "on").toLowerCase();
function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}
function isOurs(sl) {
  return !!(sl && typeof sl.command === "string" && sl.command.includes(MARKER));
}
function save(settings2) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    if (fs.existsSync(file)) fs.copyFileSync(file, file + ".bak");
  } catch {
  }
  fs.writeFileSync(file, JSON.stringify(settings2, null, 2) + "\n");
}
var settings = readSettings();
if (arg === "off") {
  if (isOurs(settings.statusLine)) {
    delete settings.statusLine;
    save(settings);
    console.log("\u2714 AgentOne status line disabled. Restart Claude Code to apply.");
  } else {
    console.log("No AgentOne status line is set \u2014 nothing to disable.");
  }
} else {
  const force = arg === "on!" || arg === "force";
  if (settings.statusLine && !isOurs(settings.statusLine) && !force) {
    console.log("\u26A0 A different statusLine is already configured in ~/.claude/settings.json.");
    console.log("  Not overriding it. To replace it, run: /tokens-config statusline=on!");
    console.log("  Or add ours manually as your statusLine command:");
    console.log("    " + STATUSLINE_CMD);
  } else {
    settings.statusLine = { type: "command", command: STATUSLINE_CMD };
    save(settings);
    console.log("\u2714 AgentOne status line enabled. Restart Claude Code to see the savings bar.");
  }
}
