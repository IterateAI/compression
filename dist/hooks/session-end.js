#!/usr/bin/env node
/* Copyright (c) 2026 Iterate.ai. All rights reserved. Authors: Brian Sathianathan, Arul Chanderasekeran — assisted by Claude. */
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// ../nodejs_optimizer/src/utils/contentDetect.js
var require_contentDetect = __commonJS({
  "../nodejs_optimizer/src/utils/contentDetect.js"(exports2, module2) {
    "use strict";
    var CODE_HINTS = /(?:^|\s)(function\s|const\s|let\s|var\s|class\s|import\s|export\s|def\s|return[\s;]|if\s*\(|for\s*\(|while\s*\()/;
    var SQL_HINTS = /\b(?:SELECT\s+[\w*,\s]+\s+FROM|INSERT\s+INTO\s+\w+|UPDATE\s+\w+\s+SET|DELETE\s+FROM\s+\w+|CREATE\s+TABLE\s+\w+)\b/i;
    var LOG_HINTS = /^\s*(\[?\d{4}-\d{2}-\d{2}|\[?(DEBUG|INFO|WARN|ERROR|TRACE)\b)/im;
    var MARKDOWN_HINTS = /^\s*(#{1,6}\s|```|\* |- |\d+\. )/m;
    function detectContentType(text) {
      if (!text || typeof text !== "string") return "prose";
      const trimmed = text.trim();
      if (trimmed.length === 0) return "prose";
      if ((trimmed[0] === "{" || trimmed[0] === "[") && trimmed.length > 1) {
        const last = trimmed[trimmed.length - 1];
        if (trimmed[0] === "{" && last === "}" || trimmed[0] === "[" && last === "]") {
          try {
            JSON.parse(trimmed);
            return "json";
          } catch {
          }
        }
      }
      if (trimmed[0] === "<" && /<\/?[a-z][\s\S]*?>/i.test(trimmed)) {
        if (/<!DOCTYPE\s+html|<html[\s>]|<body[\s>]|<div[\s>]/i.test(trimmed)) return "html";
        return "xml";
      }
      const lines = trimmed.split("\n").slice(0, 5);
      if (lines.length >= 2) {
        const commaCounts = lines.map((l) => (l.match(/,/g) || []).length);
        if (commaCounts[0] >= 2 && commaCounts.every((c) => c === commaCounts[0])) {
          return "csv";
        }
      }
      if (LOG_HINTS.test(trimmed)) return "log";
      if (SQL_HINTS.test(trimmed)) return "sql";
      if (CODE_HINTS.test(trimmed)) return "code";
      if (MARKDOWN_HINTS.test(trimmed)) return "markdown";
      return "prose";
    }
    function isWhitespaceSensitive(type) {
      return type === "code" || type === "csv" || type === "log";
    }
    module2.exports = { detectContentType, isWhitespaceSensitive };
  }
});

// ../nodejs_optimizer/src/optimizers/jsonMinifier.js
var require_jsonMinifier = __commonJS({
  "../nodejs_optimizer/src/optimizers/jsonMinifier.js"(exports2, module2) {
    "use strict";
    var REF_PREFIX = "$$ref:";
    var MIN_REPEAT_LEN = 24;
    var MIN_REPEAT_COUNT = 3;
    var TAB_MIN_ITEMS = 4;
    var TAB_UNIFORMITY_MIN = 0.8;
    var TAB_NA = "$$na";
    var TAB_NA_MAX_RATIO = 0.2;
    function minify(text, opts = {}) {
      const originalLen = text.length;
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { text, originalLen, newLen: originalLen, savedBytes: 0 };
      }
      let transformed = parsed;
      if (opts.dropNulls !== false) transformed = stripNulls(transformed);
      if (opts.tabularize) transformed = tabularize(transformed);
      if (opts.dedupeStrings !== false) transformed = dedupeStrings(transformed);
      const out = JSON.stringify(transformed);
      return {
        text: out,
        originalLen,
        newLen: out.length,
        savedBytes: originalLen - out.length
      };
    }
    function stripNulls(v) {
      if (v === null || v === void 0) return void 0;
      if (Array.isArray(v)) return v.map(stripNulls).filter((x) => x !== void 0);
      if (typeof v === "object") {
        const out = {};
        for (const k of Object.keys(v)) {
          const cleaned = stripNulls(v[k]);
          if (cleaned !== void 0) out[k] = cleaned;
        }
        return out;
      }
      return v;
    }
    function dedupeStrings(value) {
      const counts = /* @__PURE__ */ new Map();
      countStrings(value, counts);
      const refs = [];
      const refMap = /* @__PURE__ */ new Map();
      for (const [str, count] of counts) {
        if (count >= MIN_REPEAT_COUNT && str.length >= MIN_REPEAT_LEN) {
          const refOverhead = REF_PREFIX.length + 3;
          const savings = (str.length - refOverhead) * (count - 1) - str.length;
          if (savings > 0) {
            refMap.set(str, refs.length);
            refs.push(str);
          }
        }
      }
      if (refs.length === 0) return value;
      const replaced = replaceStrings(value, refMap);
      return { __refs: refs, data: replaced };
    }
    function countStrings(v, counts) {
      if (typeof v === "string") {
        counts.set(v, (counts.get(v) || 0) + 1);
      } else if (Array.isArray(v)) {
        for (const x of v) countStrings(x, counts);
      } else if (v && typeof v === "object") {
        for (const k of Object.keys(v)) countStrings(v[k], counts);
      }
    }
    function replaceStrings(v, refMap) {
      if (typeof v === "string" && refMap.has(v)) {
        return REF_PREFIX + refMap.get(v);
      }
      if (Array.isArray(v)) return v.map((x) => replaceStrings(x, refMap));
      if (v && typeof v === "object") {
        const out = {};
        for (const k of Object.keys(v)) out[k] = replaceStrings(v[k], refMap);
        return out;
      }
      return v;
    }
    function tabularize(value) {
      if (Array.isArray(value)) {
        const env = tryTabularizeArray(value);
        if (env) return env;
        return value.map(tabularize);
      }
      if (value && typeof value === "object") {
        const out = {};
        for (const k of Object.keys(value)) out[k] = tabularize(value[k]);
        return out;
      }
      return value;
    }
    function tryTabularizeArray(arr) {
      if (arr.length < TAB_MIN_ITEMS) return null;
      for (const v of arr) {
        if (!v || typeof v !== "object" || Array.isArray(v)) return null;
        if ("__cols" in v || "rows" in v) return null;
      }
      const cols = [];
      const colSet = /* @__PURE__ */ new Set();
      for (const o of arr) {
        for (const k of Object.keys(o)) {
          if (!colSet.has(k)) {
            colSet.add(k);
            cols.push(k);
          }
        }
      }
      const inter = new Set(Object.keys(arr[0]));
      for (const o of arr) {
        const ks = new Set(Object.keys(o));
        for (const k of [...inter]) if (!ks.has(k)) inter.delete(k);
      }
      if (cols.length === 0 || inter.size / cols.length < TAB_UNIFORMITY_MIN) return null;
      let naCells = 0;
      const rows = [];
      for (const o of arr) {
        const row = [];
        for (const c of cols) {
          if (c in o) {
            if (o[c] === TAB_NA) return null;
            row.push(tabularize(o[c]));
          } else {
            row.push(TAB_NA);
            naCells++;
          }
        }
        rows.push(row);
      }
      if (naCells / (cols.length * arr.length) > TAB_NA_MAX_RATIO) return null;
      const envelope = { __cols: cols, rows };
      if (JSON.stringify(envelope).length >= JSON.stringify(arr).length) return null;
      return envelope;
    }
    function isTabularEnvelope(v) {
      return Boolean(
        v && typeof v === "object" && !Array.isArray(v) && Array.isArray(v.__cols) && Array.isArray(v.rows) && Object.keys(v).length === 2 && v.__cols.every((c) => typeof c === "string")
      );
    }
    function detabularize(value) {
      if (isTabularEnvelope(value)) {
        return value.rows.map((row) => {
          const o = {};
          value.__cols.forEach((c, i) => {
            if (row[i] !== TAB_NA) o[c] = detabularize(row[i]);
          });
          return o;
        });
      }
      if (Array.isArray(value)) return value.map(detabularize);
      if (value && typeof value === "object") {
        const out = {};
        for (const k of Object.keys(value)) out[k] = detabularize(value[k]);
        return out;
      }
      return value;
    }
    function containsEnvelope(v) {
      if (isTabularEnvelope(v)) return true;
      if (Array.isArray(v)) return v.some(containsEnvelope);
      if (v && typeof v === "object") return Object.keys(v).some((k) => containsEnvelope(v[k]));
      return false;
    }
    function expand(text) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return text;
      }
      const hasRefs = parsed && typeof parsed === "object" && Array.isArray(parsed.__refs) && "data" in parsed;
      if (hasRefs) parsed = restoreRefs(parsed.data, parsed.__refs);
      if (!hasRefs && !containsEnvelope(parsed)) return text;
      return JSON.stringify(detabularize(parsed));
    }
    function restoreRefs(v, refs) {
      if (typeof v === "string" && v.startsWith(REF_PREFIX)) {
        const idx = parseInt(v.slice(REF_PREFIX.length), 10);
        if (idx >= 0 && idx < refs.length) return refs[idx];
        return v;
      }
      if (Array.isArray(v)) return v.map((x) => restoreRefs(x, refs));
      if (v && typeof v === "object") {
        const out = {};
        for (const k of Object.keys(v)) out[k] = restoreRefs(v[k], refs);
        return out;
      }
      return v;
    }
    function compressArrays(value, opts = {}) {
      const { keepFirst = 3, markerFn } = opts;
      if (Array.isArray(value)) {
        if (value.length > keepFirst + 1 && value.every((v) => v && typeof v === "object")) {
          const head = value.slice(0, keepFirst).map((v) => compressArrays(v, opts));
          const rest = value.slice(keepFirst);
          const marker = markerFn ? markerFn(rest) : `[${rest.length} more items omitted; same shape as above]`;
          return [...head, marker];
        }
        return value.map((v) => compressArrays(v, opts));
      }
      if (value && typeof value === "object") {
        const out = {};
        for (const k of Object.keys(value)) out[k] = compressArrays(value[k], opts);
        return out;
      }
      return value;
    }
    function minifyAggressive(text, opts = {}) {
      const originalLen = text.length;
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { text, originalLen, newLen: originalLen, savedBytes: 0 };
      }
      let transformed = parsed;
      if (opts.dropNulls !== false) transformed = stripNulls(transformed);
      if (opts.compressArrays === true) transformed = compressArrays(transformed, opts);
      if (opts.tabularize !== false) transformed = tabularize(transformed);
      if (opts.dedupeStrings !== false) transformed = dedupeStrings(transformed);
      const out = JSON.stringify(transformed);
      return { text: out, originalLen, newLen: out.length, savedBytes: originalLen - out.length };
    }
    module2.exports = { minify, expand, compressArrays, minifyAggressive, tabularize, detabularize };
  }
});

// ../nodejs_optimizer/src/optimizers/logCompressor.js
var require_logCompressor = __commonJS({
  "../nodejs_optimizer/src/optimizers/logCompressor.js"(exports2, module2) {
    "use strict";
    var UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
    var TS_PATTERNS = [
      /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g,
      /\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/g
    ];
    var EPOCH_PATTERN = /\b\d{10,13}\b/g;
    var HEX_ID_PATTERN = /\b[0-9a-f]{16,}\b/gi;
    var IP_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g;
    var NUMBER_PATTERN = /\b\d{4,}\b/g;
    var DEFAULT_LEVELS_TO_DROP = /* @__PURE__ */ new Set(["TRACE", "DEBUG"]);
    var LEVEL_PATTERN = /\b(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\b/;
    function compress(text, opts = {}) {
      const {
        dropLevels = DEFAULT_LEVELS_TO_DROP,
        maskVolatile = true,
        collapseRepeats = true,
        keepHeadTail = 3
      } = opts;
      const originalLen = text.length;
      const lines = text.split("\n");
      const out = [];
      const filtered = [];
      for (const line of lines) {
        const m = line.match(LEVEL_PATTERN);
        if (m && dropLevels.has(m[1].toUpperCase())) continue;
        filtered.push(line);
      }
      const masked = filtered.map((line) => maskVolatile ? maskLine(line) : line);
      if (collapseRepeats) {
        let i = 0;
        while (i < masked.length) {
          let j = i + 1;
          while (j < masked.length && masked[j] === masked[i]) j++;
          const runLen = j - i;
          if (runLen <= 1) {
            out.push(filtered[i]);
          } else if (runLen <= keepHeadTail * 2 + 1) {
            for (let k = i; k < j; k++) out.push(filtered[k]);
          } else {
            for (let k = 0; k < keepHeadTail; k++) out.push(filtered[i + k]);
            out.push(`... [${runLen - keepHeadTail * 2} similar lines omitted] ...`);
            for (let k = j - keepHeadTail; k < j; k++) out.push(filtered[k]);
          }
          i = j;
        }
      } else {
        out.push(...filtered);
      }
      const result = out.join("\n");
      return {
        text: result,
        originalLen,
        newLen: result.length,
        savedBytes: originalLen - result.length,
        droppedLines: lines.length - out.length
      };
    }
    function maskLine(line) {
      let m = line;
      m = m.replace(UUID_PATTERN, "<uuid>");
      for (const p of TS_PATTERNS) m = m.replace(p, "<ts>");
      m = m.replace(HEX_ID_PATTERN, "<hex>");
      m = m.replace(IP_PATTERN, "<ip>");
      m = m.replace(EPOCH_PATTERN, "<ts>");
      m = m.replace(NUMBER_PATTERN, "<n>");
      return m;
    }
    module2.exports = { compress, maskLine };
  }
});

// ../nodejs_optimizer/src/optimizers/codeCompressor.js
var require_codeCompressor = __commonJS({
  "../nodejs_optimizer/src/optimizers/codeCompressor.js"(exports2, module2) {
    "use strict";
    var SINGLE_LINE_COMMENT = /(^|[^:])\/\/[^\n]*/g;
    var BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
    var HASH_COMMENT = /^\s*#(?!!|\s*include)[^\n]*$/gm;
    var PYTHON_DOCSTRING = /("""[\s\S]*?"""|'''[\s\S]*?''')/g;
    function compress(text, opts = {}) {
      const { stripComments = true, stripDocstrings = false, collapseBlankLines = true } = opts;
      const originalLen = text.length;
      let language = opts.language || detectLanguage(text);
      let out = text;
      if (stripComments) {
        if (language === "python" || language === "shell" || language === "ruby") {
          out = out.replace(HASH_COMMENT, "");
        }
        if (language !== "python" && language !== "shell" && language !== "ruby") {
          out = out.replace(BLOCK_COMMENT, "");
          out = out.replace(SINGLE_LINE_COMMENT, "$1");
        }
      }
      if (stripDocstrings && language === "python") {
        out = out.replace(PYTHON_DOCSTRING, "");
      }
      if (collapseBlankLines) {
        out = out.replace(/\n[ \t]*\n[ \t]*(?:\n[ \t]*)+/g, "\n\n");
      }
      out = out.replace(/[ \t]+$/gm, "");
      return {
        text: out,
        originalLen,
        newLen: out.length,
        savedBytes: originalLen - out.length,
        language
      };
    }
    function detectLanguage(text) {
      if (/^\s*(?:export\s+|import\s+.+\s+from\s+['"]|const\s+\w+\s*=|let\s+\w+\s*=|function\s*\*?\s*\w*\s*\(|interface\s+\w+|type\s+\w+\s*=)/m.test(text)) return "javascript";
      if (/^\s*(?:def\s+\w+\s*\(|class\s+\w+\s*[(:]|from\s+\S+\s+import\s+|if\s+__name__\s*==)/m.test(text)) return "python";
      if (/^\s*(?:#include|int\s+main\s*\(|void\s+main\s*\()/m.test(text)) return "c";
      if (/^\s*(?:package\s+\w+|func\s+\w+\s*\(|import\s*\()/m.test(text)) return "go";
      if (/^\s*(?:fn\s+\w+\s*\(|let\s+mut|use\s+\w+::)/m.test(text)) return "rust";
      if (/^\s*(?:public\s+class|private\s+\w|protected\s+\w)/m.test(text)) return "java";
      if (/^#!\/(?:usr\/)?bin\/(?:bash|sh|zsh)/.test(text)) return "shell";
      return "unknown";
    }
    module2.exports = { compress, detectLanguage };
  }
});

// ../nodejs_optimizer/src/optimizers/astCompressor.js
var require_astCompressor = __commonJS({
  "../nodejs_optimizer/src/optimizers/astCompressor.js"(exports2, module2) {
    "use strict";
    var injectedParser = null;
    function setParser(fn) {
      injectedParser = fn;
    }
    function resetParser() {
      injectedParser = null;
    }
    function findMatchingBrace(text, openIdx) {
      let depth = 1;
      let i = openIdx + 1;
      const n = text.length;
      while (i < n) {
        const c = text[i];
        if (c === "/" && text[i + 1] === "/") {
          i = text.indexOf("\n", i);
          if (i === -1) return -1;
          i++;
          continue;
        }
        if (c === "/" && text[i + 1] === "*") {
          const end = text.indexOf("*/", i + 2);
          if (end === -1) return -1;
          i = end + 2;
          continue;
        }
        if (c === '"' || c === "'") {
          i++;
          while (i < n && text[i] !== c) {
            if (text[i] === "\\") i++;
            i++;
          }
          i++;
          continue;
        }
        if (c === "`") {
          i++;
          while (i < n && text[i] !== "`") {
            if (text[i] === "\\") {
              i += 2;
              continue;
            }
            if (text[i] === "$" && text[i + 1] === "{") {
              const end = findMatchingBrace(text, i + 1);
              if (end === -1) return -1;
              i = end + 1;
              continue;
            }
            i++;
          }
          i++;
          continue;
        }
        if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) return i;
        }
        i++;
      }
      return -1;
    }
    function compress(text, opts = {}) {
      const originalLen = text.length;
      if (!text || typeof text !== "string") {
        return { text, originalLen, newLen: originalLen, savedBytes: 0, mode: "noop" };
      }
      if (injectedParser) {
        try {
          const r = injectedParser(text);
          return { ...r, originalLen };
        } catch {
        }
      }
      const {
        dropArrows = true,
        dropFunctions = true,
        dropMethods = true,
        placeholder = "/* ... */"
      } = opts;
      const ranges = [];
      if (dropFunctions) {
        const pat = /\b(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)?\s*(?:<[^<>{}]*>)?\s*\([\s\S]*?\)(?:\s*:\s*[^{=;]+?)?\s*\{/g;
        let m;
        while ((m = pat.exec(text)) !== null) {
          const open = m.index + m[0].length - 1;
          const close = findMatchingBrace(text, open);
          if (close > open) {
            ranges.push([open + 1, close]);
            pat.lastIndex = close + 1;
          }
        }
      }
      if (dropMethods) {
        const keywords = /* @__PURE__ */ new Set([
          "if",
          "else",
          "for",
          "while",
          "do",
          "switch",
          "case",
          "default",
          "try",
          "catch",
          "finally",
          "return",
          "throw",
          "with",
          "await",
          "typeof",
          "in",
          "of",
          "instanceof",
          "new",
          "delete",
          "void",
          "yield",
          "async",
          "function",
          "class"
        ]);
        const pat = /(^|[\s\n;,:{}()=>])(static\s+|async\s+|get\s+|set\s+|\*\s*)*([A-Za-z_$#][\w$]*|\[[^\]\n]+\])\s*(?:<[^<>{}]*>)?\s*\([\s\S]*?\)(?:\s*:\s*[^{=;]+?)?\s*\{/g;
        let m;
        while ((m = pat.exec(text)) !== null) {
          const name = m[3];
          if (keywords.has(name)) continue;
          const before = text.slice(Math.max(0, m.index - 12), m.index + m[1].length).trim();
          if (/\bfunction\s*\*?\s*$/.test(before)) continue;
          const open = m.index + m[0].length - 1;
          const close = findMatchingBrace(text, open);
          if (close > open) {
            ranges.push([open + 1, close]);
            pat.lastIndex = close + 1;
          }
        }
      }
      if (dropArrows) {
        const pat = /=>\s*\{/g;
        let m;
        while ((m = pat.exec(text)) !== null) {
          const open = m.index + m[0].length - 1;
          const close = findMatchingBrace(text, open);
          if (close > open) {
            ranges.push([open + 1, close]);
            pat.lastIndex = close + 1;
          }
        }
      }
      if (ranges.length === 0) {
        return { text, originalLen, newLen: originalLen, savedBytes: 0, mode: "regex" };
      }
      ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
      const merged = [];
      for (const [s, e] of ranges) {
        if (merged.length && s < merged[merged.length - 1][1]) continue;
        merged.push([s, e]);
      }
      const mkPlaceholder = typeof placeholder === "function" ? placeholder : () => placeholder;
      const parts = [];
      let cursor = text.length;
      for (let i = merged.length - 1; i >= 0; i--) {
        const [s, e] = merged[i];
        parts.unshift(text.slice(e, cursor));
        parts.unshift(mkPlaceholder(text.slice(s, e)));
        cursor = s;
      }
      parts.unshift(text.slice(0, cursor));
      const out = parts.join("");
      return {
        text: out,
        originalLen,
        newLen: out.length,
        savedBytes: originalLen - out.length,
        mode: "regex",
        dropped: merged.length
      };
    }
    function extractSignatures(text) {
      const out = [];
      const fnPat = /\b(export\s+)?(async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^<>{}]*>)?\s*\([^)]*\)(?:\s*:\s*[^{=;]+?)?/g;
      const classPat = /\b(export\s+)?(abstract\s+)?class\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+[^\s{]+)?(?:\s+implements\s+[^{]+)?/g;
      let m;
      while ((m = fnPat.exec(text)) !== null) {
        out.push({ kind: "function", name: m[3], signature: m[0].trim() });
      }
      while ((m = classPat.exec(text)) !== null) {
        out.push({ kind: "class", name: m[3], signature: m[0].trim() });
      }
      return out;
    }
    module2.exports = { compress, extractSignatures, findMatchingBrace, setParser, resetParser };
  }
});

// ../nodejs_optimizer/src/optimizers/whitespace.js
var require_whitespace = __commonJS({
  "../nodejs_optimizer/src/optimizers/whitespace.js"(exports2, module2) {
    "use strict";
    var { isWhitespaceSensitive } = require_contentDetect();
    var ZERO_WIDTH = /[​-‍﻿⁠]/g;
    function normalize(text, { contentType = "prose", aggressive = false } = {}) {
      if (typeof text !== "string" || text.length === 0) return text;
      if (isWhitespaceSensitive(contentType)) {
        return text.replace(ZERO_WIDTH, "").replace(/[ \t]+$/gm, "");
      }
      let out = text.replace(ZERO_WIDTH, "");
      out = out.replace(/[ \t]+$/gm, "");
      out = out.replace(/\n{3,}/g, "\n\n");
      if (aggressive) {
        if (contentType === "markdown") {
          out = preserveBlocks(out, /```[\s\S]*?```|`[^`\n]+`/g, (chunk) => {
            return chunk.replace(/[ \t]{2,}/g, " ").replace(/\n{2,}/g, "\n\n");
          });
        } else {
          out = out.replace(/(\S)[ \t]{4,}(\S)/g, "$1 $2");
          out = out.replace(/(\S)  +(\S)/g, "$1 $2");
        }
      }
      return out;
    }
    function preserveBlocks(text, protectPattern, transform) {
      const segments = [];
      let lastIdx = 0;
      let m;
      protectPattern.lastIndex = 0;
      while ((m = protectPattern.exec(text)) !== null) {
        if (m.index > lastIdx) {
          segments.push(transform(text.slice(lastIdx, m.index)));
        }
        segments.push(m[0]);
        lastIdx = m.index + m[0].length;
        if (m[0].length === 0) protectPattern.lastIndex++;
      }
      if (lastIdx < text.length) {
        segments.push(transform(text.slice(lastIdx)));
      }
      return segments.join("");
    }
    module2.exports = { normalize };
  }
});

// ../nodejs_optimizer/src/strategies/contentRouter.js
var require_contentRouter = __commonJS({
  "../nodejs_optimizer/src/strategies/contentRouter.js"(exports2, module2) {
    "use strict";
    var { detectContentType: heuristicDetect } = require_contentDetect();
    var jsonMin = require_jsonMinifier();
    var logComp = require_logCompressor();
    var codeComp = require_codeCompressor();
    var astComp = require_astCompressor();
    var whitespace = require_whitespace();
    var activeDetector = heuristicDetect;
    function setDetector(fn) {
      activeDetector = fn || heuristicDetect;
    }
    function getDetector() {
      return activeDetector;
    }
    function detectContentType(text) {
      return activeDetector(text);
    }
    function compressContent(text, opts = {}) {
      if (typeof text !== "string" || text.length === 0) {
        return { text, type: "empty", savedBytes: 0, originalLen: 0, newLen: 0 };
      }
      const type = opts.forceType || detectContentType(text);
      const aggressive = opts.aggressive === true;
      const codeMode = opts.codeMode || "comments";
      const originalLen = text.length;
      let compressed;
      switch (type) {
        case "json": {
          const r = jsonMin.minify(text, { dropNulls: aggressive });
          compressed = r.text;
          break;
        }
        case "log": {
          const r = logComp.compress(text, { collapseRepeats: true, maskVolatile: aggressive });
          compressed = r.text;
          break;
        }
        case "code":
        case "sql": {
          if (type === "code" && codeMode === "ast") {
            const lang = codeComp.detectLanguage(text);
            if (lang === "javascript" || lang === "unknown") {
              const r = astComp.compress(text);
              compressed = r.text;
            } else {
              const r = codeComp.compress(text, { language: lang, stripComments: true, collapseBlankLines: true, stripDocstrings: aggressive });
              compressed = r.text;
            }
          } else {
            const r = codeComp.compress(text, { stripComments: true, collapseBlankLines: true, stripDocstrings: aggressive });
            compressed = r.text;
          }
          break;
        }
        case "xml":
        case "html": {
          compressed = text.replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").replace(/\s{2,}/g, " ");
          break;
        }
        case "markdown":
        case "prose":
        default: {
          compressed = whitespace.normalize(text, { contentType: type, aggressive });
          break;
        }
      }
      return {
        text: compressed,
        type,
        originalLen,
        newLen: compressed.length,
        savedBytes: originalLen - compressed.length
      };
    }
    module2.exports = { compressContent, setDetector, getDetector, detectContentType };
  }
});

// ../nodejs_optimizer/src/optimizers/abbreviation.js
var require_abbreviation = __commonJS({
  "../nodejs_optimizer/src/optimizers/abbreviation.js"(exports2, module2) {
    "use strict";
    var SUBSTITUTIONS = [
      // Verbose framing phrases (huge savings on instruction-heavy prompts)
      { from: /\bplease (?:could you |kindly )?/gi, to: "", contextSafe: false },
      { from: /\bI would like (?:you )?to\b/gi, to: "please", contextSafe: false },
      { from: /\bcould you please\b/gi, to: "please", contextSafe: false },
      { from: /\bif (?:it is |it's )?possible\b/gi, to: "", contextSafe: false },
      { from: /\bin order to\b/gi, to: "to", contextSafe: false },
      { from: /\bat this (?:point in time|moment)\b/gi, to: "now", contextSafe: false },
      { from: /\bdue to the fact that\b/gi, to: "because", contextSafe: false },
      { from: /\bin the event that\b/gi, to: "if", contextSafe: false },
      { from: /\bfor the purpose of\b/gi, to: "for", contextSafe: false },
      { from: /\bwith regard to\b/gi, to: "about", contextSafe: false },
      { from: /\ba large number of\b/gi, to: "many", contextSafe: false },
      { from: /\ba small number of\b/gi, to: "few", contextSafe: false },
      { from: /\bin spite of the fact that\b/gi, to: "although", contextSafe: false },
      { from: /\bon the basis of\b/gi, to: "from", contextSafe: false },
      { from: /\bin the case of\b/gi, to: "for", contextSafe: false },
      { from: /\bit is important to note that\b/gi, to: "note:", contextSafe: false },
      { from: /\bit should be noted that\b/gi, to: "note:", contextSafe: false },
      { from: /\bas a matter of fact\b/gi, to: "in fact", contextSafe: false },
      { from: /\bwith the exception of\b/gi, to: "except", contextSafe: false },
      { from: /\bin the near future\b/gi, to: "soon", contextSafe: false },
      { from: /\bon a (?:daily|regular) basis\b/gi, to: "regularly", contextSafe: false },
      { from: /\bat the present time\b/gi, to: "now", contextSafe: false },
      { from: /\bthe majority of\b/gi, to: "most", contextSafe: false },
      { from: /\ba sufficient amount of\b/gi, to: "enough", contextSafe: false },
      { from: /\bin close proximity to\b/gi, to: "near", contextSafe: false },
      { from: /\bdespite the fact that\b/gi, to: "although", contextSafe: false },
      { from: /\bregardless of the fact that\b/gi, to: "although", contextSafe: false },
      { from: /\bprior to the (?:start|beginning) of\b/gi, to: "before", contextSafe: false },
      { from: /\bsubsequent to\b/gi, to: "after", contextSafe: false },
      { from: /\bgive consideration to\b/gi, to: "consider", contextSafe: false },
      { from: /\bmake a (?:decision|determination)\b/gi, to: "decide", contextSafe: false },
      { from: /\bcome to a conclusion\b/gi, to: "conclude", contextSafe: false },
      { from: /\bhave the (?:ability|capacity) to\b/gi, to: "can", contextSafe: false },
      { from: /\bis able to\b/gi, to: "can", contextSafe: false },
      { from: /\bin (?:my|our) opinion,?\s*/gi, to: "", contextSafe: false },
      { from: /\b(?:I|we) think (?:that )?/gi, to: "", contextSafe: false },
      { from: /\b(?:I|we) believe (?:that )?/gi, to: "", contextSafe: false },
      { from: /\bit (?:appears|seems) (?:that|to be) /gi, to: "", contextSafe: false },
      { from: /\bgoing forward,?\s*/gi, to: "", contextSafe: false },
      { from: /\bat the end of the day,?\s*/gi, to: "", contextSafe: false },
      { from: /\bneedless to say,?\s*/gi, to: "", contextSafe: false },
      { from: /\bfor all intents and purposes,?\s*/gi, to: "", contextSafe: false },
      { from: /\b(?:basically|essentially|literally|actually|really|very|quite),?\s+/gi, to: "", contextSafe: false },
      // Common contractions (small but additive)
      { from: /\bdo not\b/g, to: "don't", contextSafe: false },
      { from: /\bdoes not\b/g, to: "doesn't", contextSafe: false },
      { from: /\bdid not\b/g, to: "didn't", contextSafe: false },
      { from: /\bcannot\b/g, to: "can't", contextSafe: false },
      { from: /\bwill not\b/g, to: "won't", contextSafe: false },
      { from: /\bshould not\b/g, to: "shouldn't", contextSafe: false },
      { from: /\bwould not\b/g, to: "wouldn't", contextSafe: false },
      { from: /\bis not\b/g, to: "isn't", contextSafe: false },
      { from: /\bare not\b/g, to: "aren't", contextSafe: false },
      { from: /\bhave not\b/g, to: "haven't", contextSafe: false },
      { from: /\bhas not\b/g, to: "hasn't", contextSafe: false },
      { from: /\bit is\b/g, to: "it's", contextSafe: false },
      { from: /\bthat is\b/g, to: "that's", contextSafe: false },
      { from: /\bthere is\b/g, to: "there's", contextSafe: false },
      { from: /\byou are\b/g, to: "you're", contextSafe: false },
      { from: /\bwe are\b/g, to: "we're", contextSafe: false },
      { from: /\bthey are\b/g, to: "they're", contextSafe: false }
    ];
    function abbreviate(text, opts = {}) {
      if (typeof text !== "string" || text.length === 0) return text;
      const { aggressive = true, preserveQuotes = true, customRules = [], contextSafe = false } = opts;
      const rules = SUBSTITUTIONS.filter((r) => contextSafe ? r.contextSafe : true);
      if (!aggressive) {
        rules.length = 0;
        rules.push(
          { from: /\bin order to\b/gi, to: "to" },
          { from: /\bdue to the fact that\b/gi, to: "because" },
          { from: /\bat the present time\b/gi, to: "now" },
          { from: /\bit is important to note that\b/gi, to: "note:" }
        );
      }
      let out = text;
      if (preserveQuotes) {
        out = applyWithProtection(out, /"[^"\n]{0,200}"|'[^'\n]{0,200}'|`[^`\n]{0,200}`|```[\s\S]*?```/g, (segment) => {
          let s = segment;
          for (const r of rules) s = s.replace(r.from, r.to);
          for (const r of customRules) s = s.replace(r.from, r.to);
          s = s.replace(/  +/g, " ").replace(/ ([,.;:!?])/g, "$1");
          return s;
        });
      } else {
        for (const r of rules) out = out.replace(r.from, r.to);
        for (const r of customRules) out = out.replace(r.from, r.to);
        out = out.replace(/  +/g, " ").replace(/ ([,.;:!?])/g, "$1");
      }
      return out;
    }
    function applyWithProtection(text, protectPattern, transform) {
      const out = [];
      let last = 0;
      let m;
      protectPattern.lastIndex = 0;
      while ((m = protectPattern.exec(text)) !== null) {
        if (m.index > last) out.push(transform(text.slice(last, m.index)));
        out.push(m[0]);
        last = m.index + m[0].length;
        if (m[0].length === 0) protectPattern.lastIndex++;
      }
      if (last < text.length) out.push(transform(text.slice(last)));
      return out.join("");
    }
    module2.exports = { abbreviate, SUBSTITUTIONS };
  }
});

// ../nodejs_optimizer/src/optimizers/stopwords.js
var require_stopwords = __commonJS({
  "../nodejs_optimizer/src/optimizers/stopwords.js"(exports2, module2) {
    "use strict";
    var FILLER_WORDS = /* @__PURE__ */ new Set([
      "um",
      "uh",
      "er",
      "ah",
      "like",
      "you know",
      "i mean",
      "sort of",
      "kind of",
      "basically",
      "literally",
      "actually",
      "really",
      "very",
      "just",
      "quite",
      "pretty",
      "rather",
      "somewhat",
      "fairly"
    ]);
    var DISCOURSE_MARKERS = /* @__PURE__ */ new Set([
      "well",
      "so",
      "okay",
      "right",
      "now",
      "anyway",
      "anyhow",
      "however",
      "though",
      "therefore",
      "furthermore",
      "moreover",
      "additionally"
    ]);
    function removeStopwords(text, opts = {}) {
      if (typeof text !== "string" || text.length === 0) return text;
      const { discourse = false, preserveQuoted = true } = opts;
      const targets = new Set(FILLER_WORDS);
      if (discourse) for (const w of DISCOURSE_MARKERS) targets.add(w);
      const pattern = buildPattern(targets);
      if (preserveQuoted) {
        return applyWithProtection(text, /"[^"\n]{0,200}"|'[^'\n]{0,200}'|`[^`\n]{0,200}`|```[\s\S]*?```/g, (chunk) => {
          return cleanChunk(chunk, pattern);
        });
      }
      return cleanChunk(text, pattern);
    }
    function cleanChunk(text, pattern) {
      let out = text.replace(pattern, "");
      out = out.replace(/  +/g, " ").replace(/ ([,.;:!?])/g, "$1").replace(/^[ \t]+/gm, (m) => m);
      return out;
    }
    function buildPattern(set) {
      const escaped = [...set].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      return new RegExp(`\\b(?:${escaped.join("|")})\\b,?\\s*`, "gi");
    }
    function applyWithProtection(text, protectPattern, transform) {
      const out = [];
      let last = 0;
      let m;
      protectPattern.lastIndex = 0;
      while ((m = protectPattern.exec(text)) !== null) {
        if (m.index > last) out.push(transform(text.slice(last, m.index)));
        out.push(m[0]);
        last = m.index + m[0].length;
        if (m[0].length === 0) protectPattern.lastIndex++;
      }
      if (last < text.length) out.push(transform(text.slice(last)));
      return out.join("");
    }
    module2.exports = { removeStopwords, FILLER_WORDS, DISCOURSE_MARKERS };
  }
});

// ../nodejs_optimizer/src/utils/hash.js
var require_hash = __commonJS({
  "../nodejs_optimizer/src/utils/hash.js"(exports2, module2) {
    "use strict";
    var crypto = require("crypto");
    function stableHash(value) {
      const canonical = canonicalStringify(value);
      return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
    }
    function canonicalStringify(value) {
      if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
      }
      if (Array.isArray(value)) {
        return "[" + value.map(canonicalStringify).join(",") + "]";
      }
      const keys = Object.keys(value).sort();
      const parts = keys.map((k) => JSON.stringify(k) + ":" + canonicalStringify(value[k]));
      return "{" + parts.join(",") + "}";
    }
    function minHashSketch(text, k = 64, shingleSize = 4) {
      const norm = text.toLowerCase().replace(/\s+/g, " ").trim();
      const shingles = /* @__PURE__ */ new Set();
      if (norm.length < shingleSize) {
        shingles.add(norm);
      } else {
        for (let i = 0; i <= norm.length - shingleSize; i++) {
          shingles.add(norm.slice(i, i + shingleSize));
        }
      }
      const sketch = new Int32Array(k).fill(2147483647);
      const shingleHashes = [];
      for (const s of shingles) {
        shingleHashes.push(fnv1a(s));
      }
      for (let i = 0; i < k; i++) {
        const seed = i * 2654435761 | 0;
        let min = 2147483647;
        for (const h of shingleHashes) {
          const mixed = (h ^ seed) >>> 0;
          const finalH = Math.imul(mixed, 2246822507) ^ mixed >>> 13 | 0;
          if (finalH < min) min = finalH;
        }
        sketch[i] = min;
      }
      return sketch;
    }
    function jaccardSimilarity(a, b) {
      if (!a || !b || a.length !== b.length) return 0;
      let same = 0;
      for (let i = 0; i < a.length; i++) {
        if (a[i] === b[i]) same++;
      }
      return same / a.length;
    }
    function cosineSimilarity(a, b) {
      const va = termFreq(a);
      const vb = termFreq(b);
      let dot = 0;
      let na = 0;
      let nb = 0;
      for (const [term, count] of va) {
        na += count * count;
        if (vb.has(term)) dot += count * vb.get(term);
      }
      for (const c of vb.values()) nb += c * c;
      if (na === 0 || nb === 0) return 0;
      return dot / (Math.sqrt(na) * Math.sqrt(nb));
    }
    function termFreq(text) {
      const m = /* @__PURE__ */ new Map();
      const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];
      for (const t of tokens) m.set(t, (m.get(t) || 0) + 1);
      return m;
    }
    function fnv1a(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }
    module2.exports = {
      stableHash,
      canonicalStringify,
      minHashSketch,
      jaccardSimilarity,
      cosineSimilarity,
      fnv1a
    };
  }
});

// ../nodejs_optimizer/src/optimizers/dedup.js
var require_dedup = __commonJS({
  "../nodejs_optimizer/src/optimizers/dedup.js"(exports2, module2) {
    "use strict";
    var { minHashSketch, jaccardSimilarity } = require_hash();
    var DEFAULT_THRESHOLD = 0.92;
    function dedupeMessages(messages, opts = {}) {
      const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
      const exactOnly = opts.exactOnly === true;
      const seen = [];
      const keep = new Array(messages.length).fill(true);
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        if (m.role === "system") continue;
        const content = stringContent(m.content);
        if (!content || content.length < 32) continue;
        if (exactOnly) {
          const dup = seen.find((s) => s.content === content);
          if (dup) {
            keep[i] = false;
            continue;
          }
          seen.push({ idx: i, content, sketch: null });
        } else {
          const sketch = minHashSketch(content);
          const dup = seen.find((s) => {
            if (s.content === content) return true;
            if (!s.sketch) return false;
            return jaccardSimilarity(sketch, s.sketch) >= threshold;
          });
          if (dup) {
            keep[i] = false;
            continue;
          }
          seen.push({ idx: i, content, sketch });
        }
      }
      const out = [];
      let removed = 0;
      for (let i = 0; i < messages.length; i++) {
        if (keep[i]) out.push(messages[i]);
        else removed++;
      }
      return { messages: out, removed };
    }
    function stringContent(content) {
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content.map((p) => typeof p === "string" ? p : p && typeof p.text === "string" ? p.text : "").join("\n");
      }
      if (content && typeof content === "object" && typeof content.text === "string") return content.text;
      return "";
    }
    module2.exports = { dedupeMessages };
  }
});

// ../nodejs_optimizer/src/utils/tokenCounter.js
var require_tokenCounter = __commonJS({
  "../nodejs_optimizer/src/utils/tokenCounter.js"(exports2, module2) {
    "use strict";
    var injectedCounter = null;
    function setTokenizer(fn) {
      if (typeof fn !== "function") {
        throw new TypeError("Tokenizer must be a function");
      }
      injectedCounter = fn;
    }
    function resetTokenizer() {
      injectedCounter = null;
    }
    function heuristicCount(text) {
      if (text == null) return 0;
      if (typeof text !== "string") text = String(text);
      if (text.length === 0) return 0;
      if (text.length < 8) {
        return Math.max(1, Math.ceil(text.length / 3));
      }
      let codeChars = 0;
      let wsRuns = 0;
      let inWs = false;
      let punctChars = 0;
      let digitChars = 0;
      for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        const isWs = c === 32 || c === 9 || c === 10 || c === 13;
        if (isWs) {
          if (!inWs) wsRuns++;
          inWs = true;
        } else {
          inWs = false;
        }
        if (c >= 33 && c <= 47 || c >= 58 && c <= 64 || c >= 91 && c <= 96 || c >= 123 && c <= 126) {
          punctChars++;
          if (c === 123 || c === 125 || c === 91 || c === 93 || c === 40 || c === 41 || c === 60 || c === 62) {
            codeChars++;
          }
        }
        if (c >= 48 && c <= 57) digitChars++;
      }
      const len = text.length;
      const punctRatio = punctChars / len;
      const codeRatio = codeChars / len;
      let cpt;
      if (codeRatio > 0.04 || punctRatio > 0.15) {
        cpt = 3.2;
      } else if (digitChars / len > 0.3) {
        cpt = 2.8;
      } else {
        cpt = 4;
      }
      let nonAscii = 0;
      for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) > 127) nonAscii++;
      }
      const asciiLen = len - nonAscii;
      const baseTokens = asciiLen / cpt;
      const nonAsciiTokens = nonAscii * 1.2;
      const wsCorrection = -Math.max(0, wsRuns - asciiLen / 10) * 0.3;
      return Math.max(1, Math.round(baseTokens + nonAsciiTokens + wsCorrection));
    }
    function countTokens(text, model) {
      if (injectedCounter) {
        try {
          return injectedCounter(text, model);
        } catch {
          return heuristicCount(text);
        }
      }
      return heuristicCount(text);
    }
    function countMessages(messages, model) {
      if (!Array.isArray(messages) || messages.length === 0) return 0;
      let total = 0;
      for (const m of messages) {
        total += 4;
        if (typeof m.content === "string") {
          total += countTokens(m.content, model);
        } else if (Array.isArray(m.content)) {
          for (const part of m.content) {
            if (typeof part === "string") total += countTokens(part, model);
            else if (part && typeof part.text === "string") total += countTokens(part.text, model);
            else if (part && typeof part === "object") total += countTokens(JSON.stringify(part), model);
          }
        }
        if (m.name) total += countTokens(m.name, model);
      }
      total += 2;
      return total;
    }
    module2.exports = {
      countTokens,
      countMessages,
      setTokenizer,
      resetTokenizer,
      heuristicCount
    };
  }
});

// ../nodejs_optimizer/src/optimizers/historyCompactor.js
var require_historyCompactor = __commonJS({
  "../nodejs_optimizer/src/optimizers/historyCompactor.js"(exports2, module2) {
    "use strict";
    var { countMessages, countTokens } = require_tokenCounter();
    var DEFAULT_KEEP_RECENT = 6;
    var DEFAULT_MAX_MESSAGES = 30;
    var DEFAULT_MAX_TOKENS = 12e3;
    async function compact(messages, opts = {}) {
      const {
        keepRecent = DEFAULT_KEEP_RECENT,
        maxMessages = DEFAULT_MAX_MESSAGES,
        maxTokens = DEFAULT_MAX_TOKENS,
        summarizer = null,
        model = void 0
      } = opts;
      if (!Array.isArray(messages) || messages.length === 0) {
        return { messages, summarized: 0, beforeTokens: 0, afterTokens: 0 };
      }
      const beforeTokens = countMessages(messages, model);
      const needsCompact = messages.length > maxMessages || beforeTokens > maxTokens;
      if (!needsCompact) {
        return { messages, summarized: 0, beforeTokens, afterTokens: beforeTokens };
      }
      const systemMessages = messages.filter((m) => m.role === "system");
      const nonSystem = messages.filter((m) => m.role !== "system");
      if (nonSystem.length <= keepRecent) {
        return { messages, summarized: 0, beforeTokens, afterTokens: beforeTokens };
      }
      const toSummarize = nonSystem.slice(0, nonSystem.length - keepRecent);
      const recent = nonSystem.slice(nonSystem.length - keepRecent);
      let summaryText;
      if (typeof summarizer === "function") {
        try {
          summaryText = await summarizer(toSummarize, { model });
        } catch (err) {
          summaryText = extractiveSummary(toSummarize);
        }
      } else {
        summaryText = extractiveSummary(toSummarize);
      }
      const summaryMessage = {
        role: "assistant",
        content: `[Earlier conversation summary]
${summaryText}`,
        _isSummary: true
      };
      const out = [...systemMessages, summaryMessage, ...recent];
      const afterTokens = countMessages(out, model);
      return {
        messages: out,
        summarized: toSummarize.length,
        beforeTokens,
        afterTokens
      };
    }
    function extractiveSummary(messages) {
      const lines = [];
      for (const m of messages) {
        const text = stringContent(m.content);
        if (!text) continue;
        const head = text.split(/(?<=[.!?])\s+/)[0] || text.slice(0, 200);
        const role = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : m.role;
        lines.push(`${role}: ${head.trim()}`);
      }
      return lines.join("\n");
    }
    function stringContent(content) {
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content.map((p) => typeof p === "string" ? p : p && typeof p.text === "string" ? p.text : "").join("\n");
      }
      if (content && typeof content === "object" && typeof content.text === "string") return content.text;
      return "";
    }
    module2.exports = { compact, extractiveSummary };
  }
});

// ../nodejs_optimizer/src/optimizers/truncation.js
var require_truncation = __commonJS({
  "../nodejs_optimizer/src/optimizers/truncation.js"(exports2, module2) {
    "use strict";
    var { countTokens, countMessages } = require_tokenCounter();
    function truncateToFit(messages, maxInputTokens, opts = {}) {
      const { model, reserveOutput = 512, keepRecent = 4 } = opts;
      const budget = maxInputTokens - reserveOutput;
      const beforeTokens = countMessages(messages, model);
      if (beforeTokens <= budget) {
        return { messages, truncated: false, beforeTokens, afterTokens: beforeTokens };
      }
      const sysMessages = messages.filter((m) => m.role === "system");
      const nonSys = messages.filter((m) => m.role !== "system");
      const recent = nonSys.slice(-keepRecent);
      const old = nonSys.slice(0, -keepRecent);
      const sysTokens = countMessages(sysMessages, model);
      const recentTokens = countMessages(recent, model);
      let remainingBudget = budget - sysTokens - recentTokens;
      const trimmedOld = [];
      for (let i = old.length - 1; i >= 0; i--) {
        const m = old[i];
        const t = singleMessageTokens(m, model);
        if (t <= remainingBudget) {
          trimmedOld.unshift(m);
          remainingBudget -= t;
        } else if (remainingBudget > 64) {
          trimmedOld.unshift(truncateMessage(m, remainingBudget, model));
          remainingBudget = 0;
          break;
        } else {
          break;
        }
      }
      let out = [...sysMessages, ...trimmedOld, ...recent];
      let afterTokens = countMessages(out, model);
      if (afterTokens > budget && recent.length > 0) {
        const recentCopy = recent.slice();
        while (afterTokens > budget && recentCopy.length > 1) {
          recentCopy.shift();
          out = [...sysMessages, ...trimmedOld, ...recentCopy];
          afterTokens = countMessages(out, model);
        }
        if (afterTokens > budget && recentCopy.length === 1) {
          const overflow = afterTokens - budget;
          const headTokens = singleMessageTokens(recentCopy[0], model);
          const targetTokens = Math.max(32, headTokens - overflow - 16);
          recentCopy[0] = truncateMessage(recentCopy[0], targetTokens, model);
          out = [...sysMessages, ...trimmedOld, ...recentCopy];
          afterTokens = countMessages(out, model);
        }
      }
      return { messages: out, truncated: true, beforeTokens, afterTokens };
    }
    function singleMessageTokens(m, model) {
      return countMessages([m], model);
    }
    function truncateMessage(m, targetTokens, model) {
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      const currentTokens = countTokens(text, model);
      if (currentTokens <= targetTokens) return m;
      const ratio = targetTokens / currentTokens;
      const targetChars = Math.max(100, Math.floor(text.length * ratio * 0.95));
      const headLen = Math.floor(targetChars * 0.7);
      const tailLen = targetChars - headLen - 32;
      const head = text.slice(0, headLen);
      const tail = tailLen > 0 ? text.slice(text.length - tailLen) : "";
      const truncated = `${head}
...[truncated ${text.length - headLen - tailLen} chars]...
${tail}`;
      return { ...m, content: truncated, _truncated: true };
    }
    module2.exports = { truncateToFit, truncateMessage };
  }
});

// ../nodejs_optimizer/src/optimizers/entropyMask.js
var require_entropyMask = __commonJS({
  "../nodejs_optimizer/src/optimizers/entropyMask.js"(exports2, module2) {
    "use strict";
    var DEFAULT_WINDOW = 16;
    var DEFAULT_THRESHOLD = 0.85;
    var DEFAULT_MIN_LEN = 8;
    function shannonEntropy(s) {
      if (!s || s.length === 0) return 0;
      const counts = /* @__PURE__ */ new Map();
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        counts.set(c, (counts.get(c) || 0) + 1);
      }
      let h = 0;
      const n = s.length;
      for (const c of counts.values()) {
        const p = c / n;
        h -= p * Math.log2(p);
      }
      return h;
    }
    function normalizedEntropy(s, windowSize = DEFAULT_WINDOW) {
      if (!s || s.length === 0) return 0;
      const maxEntropy = Math.log2(Math.min(windowSize, 256));
      return shannonEntropy(s) / maxEntropy;
    }
    function computeMask(text, opts = {}) {
      const { windowSize = DEFAULT_WINDOW, threshold = DEFAULT_THRESHOLD, minLen = DEFAULT_MIN_LEN } = opts;
      const mask = new Uint8Array(text.length);
      if (text.length < minLen) return mask;
      for (let i = 0; i <= text.length - windowSize; i++) {
        const window = text.slice(i, i + windowSize);
        if (/\s/.test(window)) continue;
        const e = normalizedEntropy(window, windowSize);
        if (e >= threshold) {
          for (let j = i; j < i + windowSize; j++) mask[j] = 1;
        }
      }
      for (let i = 1; i < text.length; i++) {
        if (mask[i] === 1 && mask[i - 1] === 0 && !/\s/.test(text[i - 1])) {
          mask[i - 1] = 1;
          i = Math.max(0, i - 2);
        }
      }
      for (let i = 0; i < text.length - 1; i++) {
        if (mask[i] === 1 && mask[i + 1] === 0 && !/\s/.test(text[i + 1])) {
          mask[i + 1] = 1;
        }
      }
      return mask;
    }
    function protectedSpans(text, opts = {}) {
      const mask = computeMask(text, opts);
      const spans = [];
      let i = 0;
      while (i < mask.length) {
        if (mask[i] === 1) {
          let j = i + 1;
          while (j < mask.length && mask[j] === 1) j++;
          spans.push([i, j]);
          i = j;
        } else {
          i++;
        }
      }
      return spans;
    }
    function isHighEntropy(s, opts = {}) {
      if (!s || s.length < (opts.minLen ?? DEFAULT_MIN_LEN)) return false;
      if (/\s/.test(s)) return false;
      const e = normalizedEntropy(s, Math.min(s.length, opts.windowSize ?? DEFAULT_WINDOW));
      if (e < (opts.threshold ?? DEFAULT_THRESHOLD)) return false;
      let classes = 0;
      if (/[a-z]/.test(s)) classes++;
      if (/[A-Z]/.test(s)) classes++;
      if (/\d/.test(s)) classes++;
      if (/[^a-zA-Z0-9]/.test(s)) classes++;
      return classes >= 2;
    }
    module2.exports = {
      shannonEntropy,
      normalizedEntropy,
      computeMask,
      protectedSpans,
      isHighEntropy
    };
  }
});

// ../nodejs_optimizer/src/strategies/maskUnion.js
var require_maskUnion = __commonJS({
  "../nodejs_optimizer/src/strategies/maskUnion.js"(exports2, module2) {
    "use strict";
    var { computeMask: entropyMask } = require_entropyMask();
    var detectors = /* @__PURE__ */ new Map();
    function registerDetector(name, fn) {
      detectors.set(name, fn);
    }
    registerDetector("entropy", (text, opts) => entropyMask(text, opts));
    var SECRET_PATTERNS = [
      // OpenAI / Anthropic
      /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
      /sk-ant-[A-Za-z0-9_-]{20,}/g,
      // AWS
      /AKIA[0-9A-Z]{16}/g,
      /aws_secret_access_key[\s=:'"]*[A-Za-z0-9/+=]{40}/gi,
      // GitHub
      /gh[psour]_[A-Za-z0-9]{36,}/g,
      // Generic bearer
      /Bearer\s+[A-Za-z0-9._~+/-]{20,}/g,
      // JWT
      /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      // PEM private key block markers
      /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g,
      /-----END [A-Z ]+ PRIVATE KEY-----/g
    ];
    registerDetector("secrets", (text) => {
      const mask = new Uint8Array(text.length);
      for (const p of SECRET_PATTERNS) {
        p.lastIndex = 0;
        let m;
        while ((m = p.exec(text)) !== null) {
          for (let i = m.index; i < m.index + m[0].length; i++) mask[i] = 1;
          if (m[0].length === 0) p.lastIndex++;
        }
      }
      return mask;
    });
    var URL_PATTERN = /https?:\/\/[^\s'"<>`]+/g;
    registerDetector("urls", (text) => {
      const mask = new Uint8Array(text.length);
      URL_PATTERN.lastIndex = 0;
      let m;
      while ((m = URL_PATTERN.exec(text)) !== null) {
        for (let i = m.index; i < m.index + m[0].length; i++) mask[i] = 1;
      }
      return mask;
    });
    var LONG_NUMBER = /\b\d{10,}\b/g;
    registerDetector("numbers", (text) => {
      const mask = new Uint8Array(text.length);
      LONG_NUMBER.lastIndex = 0;
      let m;
      while ((m = LONG_NUMBER.exec(text)) !== null) {
        for (let i = m.index; i < m.index + m[0].length; i++) mask[i] = 1;
      }
      return mask;
    });
    function unionMask(text, opts = {}) {
      if (typeof text !== "string" || text.length === 0) {
        return { mask: new Uint8Array(0), spans: [], byDetector: {} };
      }
      const enabled = opts.enabled || Array.from(detectors.keys());
      const detectorOpts = opts.detectorOpts || {};
      const mask = new Uint8Array(text.length);
      const byDetector = {};
      for (const name of enabled) {
        const fn = detectors.get(name);
        if (!fn) continue;
        const m = fn(text, detectorOpts[name]);
        byDetector[name] = m;
        for (let i = 0; i < text.length; i++) {
          if (m[i] === 1) mask[i] = 1;
        }
      }
      return { mask, spans: maskToSpans(mask), byDetector };
    }
    function maskToSpans(mask) {
      const spans = [];
      let i = 0;
      while (i < mask.length) {
        if (mask[i] === 1) {
          let j = i + 1;
          while (j < mask.length && mask[j] === 1) j++;
          spans.push([i, j]);
          i = j;
        } else {
          i++;
        }
      }
      return spans;
    }
    function applyToUnprotected(text, mask, transform) {
      if (!mask || mask.length === 0) return transform(text);
      const out = [];
      let i = 0;
      while (i < text.length) {
        if (mask[i] === 0) {
          let j = i;
          while (j < text.length && mask[j] === 0) j++;
          out.push(transform(text.slice(i, j)));
          i = j;
        } else {
          let j = i;
          while (j < text.length && mask[j] === 1) j++;
          out.push(text.slice(i, j));
          i = j;
        }
      }
      return out.join("");
    }
    module2.exports = {
      registerDetector,
      unionMask,
      maskToSpans,
      applyToUnprotected,
      detectors
    };
  }
});

// ../nodejs_optimizer/src/strategies/cacheAligner.js
var require_cacheAligner = __commonJS({
  "../nodejs_optimizer/src/strategies/cacheAligner.js"(exports2, module2) {
    "use strict";
    var DEFAULT_PATTERNS = [
      // "Today is March 21, 2026" or "Date: 2026-03-21"
      /\bToday\s+is\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}\b/g,
      /\b(?:Date|Current date|As of)[:\s]+\d{4}-\d{2}-\d{2}\b/gi,
      /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g,
      // Session/request IDs
      /\b(?:session|request|trace|correlation)[\s_-]?id[:\s=]+[A-Za-z0-9_-]+/gi,
      // "User: <name>" lines
      /^User(?:\s+name)?:\s+.+$/gm
    ];
    var CacheAligner = class {
      /**
       * @param {object} [opts]
       * @param {RegExp[]} [opts.patterns]
       * @param {'user-tail' | 'separate-message'} [opts.strategy='user-tail']
       */
      constructor(opts = {}) {
        this.patterns = opts.patterns || DEFAULT_PATTERNS;
        this.strategy = opts.strategy || "user-tail";
      }
      /**
       * Align a messages array. Returns { messages, extractedCount, extracted }.
       *
       * @param {Array<{role:string, content:string|any}>} messages
       */
      align(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
          return { messages, extractedCount: 0, extracted: [] };
        }
        const out = messages.map((m) => ({ ...m }));
        const extracted = [];
        for (let i = 0; i < out.length; i++) {
          if (out[i].role !== "system") continue;
          if (typeof out[i].content !== "string") continue;
          let content = out[i].content;
          for (const p of this.patterns) {
            const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g");
            let m;
            re.lastIndex = 0;
            while ((m = re.exec(content)) !== null) {
              extracted.push(m[0]);
              if (m[0].length === 0) re.lastIndex++;
            }
            content = content.replace(re, "");
          }
          content = content.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
          out[i].content = content;
        }
        if (extracted.length === 0) {
          return { messages: out, extractedCount: 0, extracted };
        }
        const volatileBlock = `[Context (volatile, not part of stable prompt):
${extracted.join("\n")}
]`;
        if (this.strategy === "separate-message") {
          const lastUserIdx = findLastUserIdx(out);
          const insertAt = lastUserIdx >= 0 ? lastUserIdx : out.length;
          out.splice(insertAt, 0, { role: "user", content: volatileBlock, _isCacheAligner: true });
        } else {
          const lastUserIdx = findLastUserIdx(out);
          if (lastUserIdx >= 0) {
            const m = out[lastUserIdx];
            if (typeof m.content === "string") {
              out[lastUserIdx] = { ...m, content: m.content + "\n\n" + volatileBlock };
            } else {
              out[lastUserIdx] = { ...m, content: [...Array.isArray(m.content) ? m.content : [m.content], volatileBlock] };
            }
          } else {
            out.push({ role: "user", content: volatileBlock, _isCacheAligner: true });
          }
        }
        return { messages: out, extractedCount: extracted.length, extracted };
      }
    };
    function findLastUserIdx(messages) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") return i;
      }
      return -1;
    }
    module2.exports = { CacheAligner, DEFAULT_PATTERNS };
  }
});

// ../nodejs_optimizer/src/utils/tokenGuard.js
var require_tokenGuard = __commonJS({
  "../nodejs_optimizer/src/utils/tokenGuard.js"(exports2, module2) {
    "use strict";
    var { countTokens } = require_tokenCounter();
    function guardedTransform(text, fn, opts = {}) {
      const { model, minGain = 0 } = opts;
      let after;
      try {
        after = fn(text);
      } catch (err) {
        return { text, applied: false, reverted: false, beforeTokens: null, afterTokens: null };
      }
      if (typeof after !== "string" || after === text) {
        return { text, applied: false, reverted: false, beforeTokens: null, afterTokens: null };
      }
      const beforeTokens = countTokens(text, model);
      const afterTokens = countTokens(after, model);
      if (beforeTokens - afterTokens > minGain) {
        return { text: after, applied: true, reverted: false, beforeTokens, afterTokens };
      }
      return { text, applied: false, reverted: true, beforeTokens, afterTokens };
    }
    module2.exports = { guardedTransform };
  }
});

// ../nodejs_optimizer/src/strategies/substringMiner.js
var require_substringMiner = __commonJS({
  "../nodejs_optimizer/src/strategies/substringMiner.js"(exports2, module2) {
    "use strict";
    var QUOTED = /"([^"\\]{12,})"/g;
    var SubstringMiner = class {
      constructor(opts = {}) {
        this.minLength = opts.minLength ?? 12;
        this.minFrequency = opts.minFrequency ?? 5;
        this.maxCandidates = opts.maxCandidates ?? 512;
        this.decayEvery = opts.decayEvery ?? 1e3;
        this.sigil = opts.sigil ?? null;
        this._now = opts.now || Date.now;
        this._counts = /* @__PURE__ */ new Map();
        this._observations = 0;
      }
      _candidates(text) {
        const out = [];
        for (const line of text.split("\n")) {
          const t = line.trim();
          if (t.length >= this.minLength && (!this.sigil || !t.includes(this.sigil))) out.push(t);
        }
        let m;
        QUOTED.lastIndex = 0;
        while ((m = QUOTED.exec(text)) !== null) {
          if (m[1].length >= this.minLength && (!this.sigil || !m[1].includes(this.sigil))) out.push(m[1]);
        }
        return out;
      }
      observe(text) {
        if (typeof text !== "string" || text.length < this.minLength) return;
        for (const c of this._candidates(text)) {
          this._counts.set(c, (this._counts.get(c) || 0) + 1);
        }
        this._evict();
        this._observations++;
        if (this.decayEvery && this._observations % this.decayEvery === 0) this._decay();
      }
      _evict() {
        while (this._counts.size > this.maxCandidates) {
          let minKey = null;
          let minCount = Infinity;
          for (const [k, v] of this._counts) {
            if (v < minCount) {
              minCount = v;
              minKey = k;
            }
          }
          if (minKey === null) break;
          this._counts.delete(minKey);
        }
      }
      _decay() {
        for (const [k, v] of this._counts) {
          const nv = Math.floor(v / 2);
          if (nv <= 0) this._counts.delete(k);
          else this._counts.set(k, nv);
        }
      }
      promotable() {
        const out = [];
        for (const [original, count] of this._counts) {
          if (count >= this.minFrequency && original.length >= this.minLength) {
            out.push({ original, count });
          }
        }
        out.sort((a, b) => b.original.length * b.count - a.original.length * a.count);
        return out;
      }
      forget(original) {
        this._counts.delete(original);
      }
      stats() {
        return { candidates: this._counts.size, promotableCount: this.promotable().length };
      }
    };
    module2.exports = { SubstringMiner };
  }
});

// ../nodejs_optimizer/src/strategies/codebook.js
var require_codebook = __commonJS({
  "../nodejs_optimizer/src/strategies/codebook.js"(exports2, module2) {
    "use strict";
    var Codebook = class {
      constructor(opts = {}) {
        this.maxEntries = opts.maxEntries ?? 128;
        this.sigil = opts.sigil ?? "\xA7";
        this._version = 0;
        this._entries = [];
        this._pending = /* @__PURE__ */ new Map();
        const seed = opts.seed || [];
        if (seed.length) {
          for (const s of seed) this._pending.set(s, s.length * 1e3);
          this.commitPending();
        }
      }
      codeFor(index) {
        return this.sigil + index.toString(36);
      }
      version() {
        return this._version;
      }
      size() {
        return this._entries.length;
      }
      entries() {
        return this._entries.map((e, i) => ({ code: this.codeFor(i), original: e.original, savings: e.savings }));
      }
      lookup(original) {
        const i = this._entries.findIndex((e) => e.original === original);
        return i === -1 ? void 0 : this.codeFor(i);
      }
      stagePromotion(original, savingsEstimate) {
        if (this._entries.some((e) => e.original === original)) return;
        this._pending.set(original, savingsEstimate);
      }
      pendingSavings() {
        let s = 0;
        for (const v of this._pending.values()) s += v;
        return s;
      }
      commitPending() {
        if (this._pending.size === 0) return this._version;
        const merged = [
          ...this._entries,
          ...[...this._pending].map(([original, savings]) => ({ original, savings }))
        ];
        merged.sort((a, b) => b.savings - a.savings);
        this._entries = merged.slice(0, this.maxEntries);
        this._pending.clear();
        this._version++;
        return this._version;
      }
      renderGlossary() {
        if (this._entries.length === 0) return "";
        const lines = [`[dictionary v${this._version}]`];
        this._entries.forEach((e, i) => {
          lines.push(`${this.codeFor(i)} = ${e.original}`);
        });
        return lines.join("\n");
      }
    };
    module2.exports = { Codebook };
  }
});

// ../nodejs_optimizer/src/strategies/pricingModel.js
var require_pricingModel = __commonJS({
  "../nodejs_optimizer/src/strategies/pricingModel.js"(exports2, module2) {
    "use strict";
    var PRICING_TABLE = {
      anthropic: {
        provider: "anthropic",
        readMult: 0.1,
        writeMult5m: 1.25,
        writeMult1h: 2,
        minCacheablePrefixTokens: 4096,
        // default; per-model overrides below
        maxBreakpoints: 4,
        blockLookback: 20,
        explicitBreakpoints: true,
        inputPricePerMTok: 5
      },
      openai: {
        provider: "openai",
        readMult: 0.5,
        writeMult5m: 1,
        writeMult1h: 1,
        minCacheablePrefixTokens: 1024,
        maxBreakpoints: 0,
        blockLookback: Infinity,
        explicitBreakpoints: false,
        inputPricePerMTok: 2.5
      },
      unknown: {
        provider: "unknown",
        readMult: 1,
        writeMult5m: 1,
        writeMult1h: 1,
        minCacheablePrefixTokens: Infinity,
        // never emit a marker for unknown providers
        maxBreakpoints: 0,
        blockLookback: Infinity,
        explicitBreakpoints: false,
        inputPricePerMTok: 5
      }
    };
    var MODEL_OVERRIDES = [
      { match: /^claude-(fable-5|mythos|sonnet-4-6)/, provider: "anthropic", minCacheablePrefixTokens: 2048 },
      { match: /^claude-(3-5-sonnet|sonnet-4-5|sonnet-4-1|3-7-sonnet)/, provider: "anthropic", minCacheablePrefixTokens: 1024 },
      { match: /^claude/, provider: "anthropic" },
      { match: /^(gpt-|o[0-9]|chatgpt)/, provider: "openai" }
    ];
    function deepMerge(base, extra) {
      const out = { ...base };
      if (extra) for (const k of Object.keys(extra)) out[k] = extra[k];
      return out;
    }
    function getPricing(model, overrides) {
      let entry = PRICING_TABLE.unknown;
      const m = typeof model === "string" ? model : "";
      for (const rule of MODEL_OVERRIDES) {
        if (rule.match.test(m)) {
          const base = PRICING_TABLE[rule.provider];
          const perModel = {};
          for (const k of Object.keys(rule)) {
            if (k !== "match" && k !== "provider") perModel[k] = rule[k];
          }
          entry = deepMerge(base, perModel);
          break;
        }
      }
      if (overrides && overrides[entry.provider]) {
        entry = deepMerge(entry, overrides[entry.provider]);
      }
      return Object.freeze(entry);
    }
    module2.exports = { getPricing, PRICING_TABLE };
  }
});

// ../nodejs_optimizer/src/strategies/mutationGate.js
var require_mutationGate = __commonJS({
  "../nodejs_optimizer/src/strategies/mutationGate.js"(exports2, module2) {
    "use strict";
    function gateMutation(opts) {
      const {
        pricing,
        tokensSaved: S,
        invalidatedPrefixTokens: I,
        expectedRemainingTurns: T,
        ttl = "5m",
        forced = false
      } = opts;
      if (forced) return { allowed: true, benefit: Infinity, cost: 0 };
      const w = ttl === "1h" ? pricing.writeMult1h : pricing.writeMult5m;
      const r = pricing.readMult;
      const benefit = r * T * S;
      const cost = Math.max(0, I - S) * (w - r);
      return { allowed: benefit > cost, benefit, cost };
    }
    module2.exports = { gateMutation };
  }
});

// ../nodejs_optimizer/src/strategies/dictionaryCodec.js
var require_dictionaryCodec = __commonJS({
  "../nodejs_optimizer/src/strategies/dictionaryCodec.js"(exports2, module2) {
    "use strict";
    var { SubstringMiner } = require_substringMiner();
    var { Codebook } = require_codebook();
    var { unionMask, applyToUnprotected } = require_maskUnion();
    var { guardedTransform } = require_tokenGuard();
    var { getPricing } = require_pricingModel();
    var { gateMutation } = require_mutationGate();
    var { countTokens } = require_tokenCounter();
    var DEFAULTS = {
      enabled: false,
      mine: true,
      seed: [],
      minLength: 12,
      minFrequency: 5,
      maxCodebookEntries: 128,
      sigil: "\xA7",
      reversible: "auto"
    };
    var PROTECT_DETECTORS = ["entropy", "secrets", "urls", "numbers"];
    function escapeRegExp(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    var DictionaryCodec = class {
      /**
       * @param {object} [config] merged `dictionary` config block
       * @param {object} [deps]
       * @param {object} [deps.backend] reserved for future backend integration
       * @param {() => number} [deps.now] injectable clock
       * @param {import('./ccr').CCRStore} [deps.ccr] optional CCR backend for the reversibility enhancement
       */
      constructor(config = {}, deps = {}) {
        this.config = { ...DEFAULTS, ...config };
        this.pricingOverrides = config.pricing;
        this.ccr = deps.ccr || null;
        this._now = deps.now || Date.now;
        this._miners = /* @__PURE__ */ new Map();
        this._codebooks = /* @__PURE__ */ new Map();
        this._stats = /* @__PURE__ */ new Map();
      }
      _miner(ns) {
        if (!this._miners.has(ns)) {
          this._miners.set(ns, new SubstringMiner({
            minLength: this.config.minLength,
            minFrequency: this.config.minFrequency,
            now: this._now,
            sigil: this.config.sigil
          }));
        }
        return this._miners.get(ns);
      }
      _codebook(ns) {
        if (!this._codebooks.has(ns)) {
          this._codebooks.set(ns, new Codebook({
            seed: this.config.seed,
            maxEntries: this.config.maxCodebookEntries,
            sigil: this.config.sigil
          }));
        }
        return this._codebooks.get(ns);
      }
      _stat(ns) {
        if (!this._stats.has(ns)) this._stats.set(ns, { dictionaryErrors: 0, encodeReverts: 0, sigilCollisions: 0, replacements: 0 });
        return this._stats.get(ns);
      }
      _unprotectedText(text) {
        const { mask } = unionMask(text, { enabled: PROTECT_DETECTORS });
        if (!mask || mask.length === 0) return text;
        let out = "";
        applyToUnprotected(text, mask, (chunk) => {
          out += chunk + "\n";
          return chunk;
        });
        return out;
      }
      /**
       * Feed the miner with unprotected text only.
       * @param {string} ns namespace
       * @param {string} text
       * @param {Uint8Array} [mask] optional precomputed protection mask; computed if omitted
       */
      observe(ns, text, mask) {
        if (!this.config.enabled || !this.config.mine) return;
        try {
          if (mask) {
            let out = "";
            applyToUnprotected(text, mask, (chunk) => {
              out += chunk + "\n";
              return chunk;
            });
            this._miner(ns).observe(out);
          } else {
            this._miner(ns).observe(this._unprotectedText(text));
          }
        } catch {
          this._stat(ns).dictionaryErrors++;
        }
      }
      /** @returns {string} the codebook's rendered glossary, or '' */
      prefixBlock(ns) {
        if (!this.config.enabled) return "";
        return this._codebook(ns).renderGlossary();
      }
      /**
       * Stage miner promotions into the codebook, then commit (version bump)
       * only if `gateMutation` approves the glossary change.
       */
      maybeBumpVersion(ns, { expectedRemainingTurns = 5, model, ttl = "5m" } = {}) {
        if (!this.config.enabled) return { bumped: false, version: 0 };
        try {
          const cb = this._codebook(ns);
          const miner = this._miner(ns);
          const promos = miner.promotable();
          for (const p of promos) cb.stagePromotion(p.original, p.original.length * p.count);
          const pending = cb.pendingSavings();
          if (pending === 0) return { bumped: false, version: cb.version() };
          const pricing = getPricing(model, this.pricingOverrides);
          const tokensSaved = promos.reduce((t, p) => t + countTokens(p.original, model) * p.count, 0);
          const existingOriginals = cb.entries().map((e) => e.original);
          const postCommitLines = ["[dictionary]", ...existingOriginals, ...promos.map((p) => p.original)];
          const glossaryTokens = countTokens(postCommitLines.join("\n"), model);
          const gate = gateMutation({
            pricing,
            tokensSaved,
            invalidatedPrefixTokens: glossaryTokens,
            expectedRemainingTurns,
            ttl
          });
          if (!gate.allowed) return { bumped: false, version: cb.version() };
          const version = cb.commitPending();
          for (const p of promos) miner.forget(p.original);
          return { bumped: true, version };
        } catch {
          this._stat(ns).dictionaryErrors++;
          return { bumped: false, version: 0 };
        }
      }
      /**
       * Substitute committed codes for their originals, only in unprotected
       * chunks, guarded by a measure-and-revert token check.
       * @returns {{text: string, replacements: Array<object>, applied: boolean}}
       */
      encode(ns, text, model) {
        if (!this.config.enabled || typeof text !== "string") return { text, replacements: [], applied: false };
        const st = this._stat(ns);
        try {
          const cb = this._codebook(ns);
          const entries = cb.entries();
          if (entries.length === 0) return { text, replacements: [], applied: false };
          if (this.config.reversible === "require" && !this.ccr) return { text, replacements: [], applied: false };
          const { mask } = unionMask(text, { enabled: PROTECT_DETECTORS });
          let collision = false;
          applyToUnprotected(text, mask, (chunk) => {
            if (chunk.includes(this.config.sigil)) collision = true;
            return chunk;
          });
          if (collision) {
            st.sigilCollisions++;
            return { text, replacements: [], applied: false };
          }
          const replacements = [];
          const useCcr = this.config.reversible !== "off" && this.ccr;
          const ordered = entries.slice().sort((a, b) => b.original.length - a.original.length);
          const transform = (chunk) => {
            let out = chunk;
            for (const e of ordered) {
              const re = new RegExp(escapeRegExp(e.original), "g");
              if (re.test(out)) {
                out = out.replace(re, () => e.code);
                const rep = { code: e.code, original: e.original };
                if (useCcr) rep.retrievalId = this.ccr.store_(e.original, { type: "dict" }).id;
                replacements.push(rep);
              }
            }
            return out;
          };
          const guarded = guardedTransform(text, (t) => applyToUnprotected(t, mask, transform), { model });
          if (!guarded.applied) {
            if (guarded.reverted) st.encodeReverts++;
            return { text, replacements: [], applied: false };
          }
          st.replacements += replacements.length;
          return { text: guarded.text, replacements, applied: true };
        } catch {
          st.dictionaryErrors++;
          return { text, replacements: [], applied: false };
        }
      }
      /** Reverse committed codes → originals (offline/verification). */
      decode(ns, text) {
        const cb = this._codebook(ns);
        let out = text;
        const ordered = cb.entries().sort((a, b) => b.code.length - a.code.length);
        for (const e of ordered) {
          out = out.split(e.code).join(e.original);
        }
        return out;
      }
      stats(ns) {
        const cb = this._codebook(ns);
        return {
          name: "dictionary",
          codebookVersion: cb.version(),
          codebookSize: cb.size(),
          glossaryTokens: countTokens(cb.renderGlossary() || ""),
          ...this._stat(ns)
        };
      }
    };
    module2.exports = { DictionaryCodec };
  }
});

// ../nodejs_optimizer/src/pipeline.js
var require_pipeline = __commonJS({
  "../nodejs_optimizer/src/pipeline.js"(exports2, module2) {
    "use strict";
    var { compressContent } = require_contentRouter();
    var whitespace = require_whitespace();
    var abbreviation = require_abbreviation();
    var stopwords = require_stopwords();
    var dedup = require_dedup();
    var historyCompactor = require_historyCompactor();
    var truncation = require_truncation();
    var { countMessages, countTokens } = require_tokenCounter();
    var { detectContentType } = require_contentDetect();
    var { unionMask, applyToUnprotected } = require_maskUnion();
    var { CacheAligner } = require_cacheAligner();
    var { guardedTransform } = require_tokenGuard();
    var { DictionaryCodec } = require_dictionaryCodec();
    var DEFAULT_CONFIG = {
      dedupe: { enabled: true, threshold: 0.92, exactOnly: false },
      history: { enabled: true, keepRecent: 6, maxMessages: 30, maxTokens: 12e3 },
      cacheAligner: { enabled: false, strategy: "user-tail" },
      entropyProtection: { enabled: true, threshold: 0.85, windowSize: 16, detectors: ["entropy", "secrets", "urls"] },
      contentRouter: { enabled: true, aggressive: false, codeMode: "comments" },
      abbreviation: { enabled: true, aggressive: true, preserveQuotes: true },
      stopwords: { enabled: false, discourse: false },
      whitespace: { enabled: true, aggressive: false },
      truncation: { enabled: true, maxInputTokens: null, reserveOutput: 512, keepRecent: 4 },
      measureBeforeAfter: true,
      cacheEconomics: { enabled: false, expectedRemainingTurns: 5, ttl: "auto", manageBreakpoints: true, maxConversations: 500 },
      dictionary: { enabled: false, mine: true, seed: [], minLength: 12, minFrequency: 5, maxCodebookEntries: 128, sigil: "\xA7", reversible: "auto" }
    };
    var Pipeline = class {
      constructor(config = {}, deps = {}) {
        this.config = mergeConfig(DEFAULT_CONFIG, config);
        this.summarizer = deps.summarizer || null;
        this.tokenCounter = deps.tokenCounter || countTokens;
        this.scheduler = deps.scheduler || null;
        this.dictionaryCodec = deps.dictionaryCodec || null;
      }
      /**
       * Run the pipeline on a request shape.
       *
       * @param {object} request - { messages, model, temperature, tools, ... }
       * @returns {Promise<{request, stats}>}
       */
      async run(request) {
        const messages = (request.messages || []).slice();
        const model = request.model;
        const ns = request.user || request.metadata && request.metadata.namespace || "default";
        const stats = { steps: [], beforeTokens: 0, afterTokens: 0, savedTokens: 0, savedPercent: 0 };
        if (this.config.measureBeforeAfter) {
          stats.beforeTokens = countMessages(messages, model);
        }
        let current = messages;
        if (this.config.cacheAligner.enabled) {
          const aligner = new CacheAligner(this.config.cacheAligner);
          const r = aligner.align(current);
          stats.steps.push({ name: "cacheAligner", extracted: r.extractedCount });
          current = r.messages;
        }
        if (this.config.dedupe.enabled) {
          const r = dedup.dedupeMessages(current, this.config.dedupe);
          stats.steps.push({ name: "dedupe", removed: r.removed });
          current = r.messages;
        }
        if (this.config.history.enabled) {
          const r = await historyCompactor.compact(current, {
            ...this.config.history,
            model,
            summarizer: this.summarizer
          });
          stats.steps.push({
            name: "history",
            summarized: r.summarized,
            beforeTokens: r.beforeTokens,
            afterTokens: r.afterTokens
          });
          current = r.messages;
        }
        const guardReverts = { abbreviation: 0, stopwords: 0, whitespace: 0 };
        const transformTail = (msgs) => msgs.map((m) => this.transformMessage(m, guardReverts, model));
        if (this.scheduler && this.config.cacheEconomics && this.config.cacheEconomics.enabled) {
          current = current.map((m) => m.role === "system" ? this.transformMessage(m, guardReverts, model) : m);
          const planned = await this.scheduler.plan({ ...request, messages: current }, { transformTail });
          current = planned.request.messages;
          stats.steps.push({ name: "tokenGuard", ...guardReverts });
          if (planned.decisions) stats.steps.push(planned.decisions);
        } else {
          current = transformTail(current);
          stats.steps.push({ name: "tokenGuard", ...guardReverts });
        }
        if (this.dictionaryCodec && this.config.dictionary && this.config.dictionary.enabled) {
          const codec = this.dictionaryCodec;
          for (const m of current) {
            if (m.role !== "system" && typeof m.content === "string") codec.observe(ns, m.content);
          }
          codec.maybeBumpVersion(ns, { expectedRemainingTurns: 5, model, ttl: "5m" });
          current = current.map((m) => {
            if (m.role === "system" || typeof m.content !== "string") return m;
            const r = codec.encode(ns, m.content, model);
            return r.applied ? { ...m, content: r.text } : m;
          });
          const glossary = codec.prefixBlock(ns);
          if (glossary) current = [{ role: "system", content: glossary }, ...current];
          stats.steps.push(codec.stats(ns));
        }
        if (this.config.truncation.enabled && this.config.truncation.maxInputTokens) {
          const r = truncation.truncateToFit(current, this.config.truncation.maxInputTokens, {
            model,
            reserveOutput: this.config.truncation.reserveOutput,
            keepRecent: this.config.truncation.keepRecent
          });
          stats.steps.push({
            name: "truncation",
            truncated: r.truncated,
            beforeTokens: r.beforeTokens,
            afterTokens: r.afterTokens
          });
          current = r.messages;
        }
        if (this.config.measureBeforeAfter) {
          stats.afterTokens = countMessages(current, model);
          stats.savedTokens = stats.beforeTokens - stats.afterTokens;
          stats.savedPercent = stats.beforeTokens === 0 ? 0 : stats.savedTokens / stats.beforeTokens * 100;
        }
        const outRequest = { ...request, messages: current };
        return { request: outRequest, stats };
      }
      /**
       * Apply per-message transforms — content router, abbreviation, stopwords, whitespace.
       */
      transformMessage(message, guardReverts, model) {
        if (message._isSummary) return message;
        if (message.role === "system" && this.config.preserveSystem !== false) {
          if (typeof message.content === "string") {
            const ws = whitespace.normalize(message.content, { contentType: "prose", aggressive: false });
            return { ...message, content: ws };
          }
          return message;
        }
        return { ...message, content: this.transformContent(message.content, guardReverts, model) };
      }
      transformContent(content, guardReverts, model) {
        if (typeof content === "string") {
          return this.transformText(content, guardReverts, model);
        }
        if (Array.isArray(content)) {
          return content.map((p) => {
            if (typeof p === "string") return this.transformText(p, guardReverts, model);
            if (p && typeof p === "object" && typeof p.text === "string") {
              return { ...p, text: this.transformText(p.text, guardReverts, model) };
            }
            return p;
          });
        }
        return content;
      }
      transformText(text, guardReverts = { abbreviation: 0, stopwords: 0, whitespace: 0 }, model) {
        if (!text || typeof text !== "string") return text;
        let out = text;
        const type = detectContentType(out);
        const entropyOn = this.config.entropyProtection.enabled;
        const runProtected = (fn) => {
          if (!entropyOn) return fn(out);
          const { mask } = unionMask(out, {
            enabled: this.config.entropyProtection.detectors,
            detectorOpts: { entropy: this.config.entropyProtection }
          });
          return applyToUnprotected(out, mask, fn);
        };
        if (this.config.contentRouter.enabled) {
          const crCfg = this.config.contentRouter;
          if (type === "prose" || type === "markdown") {
            out = runProtected((chunk) => compressContent(chunk, { aggressive: crCfg.aggressive, codeMode: crCfg.codeMode }).text);
          } else {
            out = compressContent(out, { aggressive: crCfg.aggressive, codeMode: crCfg.codeMode }).text;
          }
        }
        if (type === "prose" || type === "markdown") {
          if (this.config.abbreviation.enabled) {
            const g = guardedTransform(
              out,
              () => runProtected((chunk) => abbreviation.abbreviate(chunk, this.config.abbreviation)),
              { model }
            );
            if (g.reverted) guardReverts.abbreviation++;
            out = g.text;
          }
          if (this.config.stopwords.enabled) {
            const g = guardedTransform(
              out,
              () => runProtected((chunk) => stopwords.removeStopwords(chunk, this.config.stopwords)),
              { model }
            );
            if (g.reverted) guardReverts.stopwords++;
            out = g.text;
          }
        }
        if (this.config.whitespace.enabled) {
          if (this.config.whitespace.aggressive) {
            const g = guardedTransform(
              out,
              (t) => whitespace.normalize(t, { contentType: type, aggressive: true }),
              { model }
            );
            if (g.reverted) guardReverts.whitespace++;
            out = g.text;
            if (!g.applied) {
              out = whitespace.normalize(out, { contentType: type, aggressive: false });
            }
          } else {
            out = whitespace.normalize(out, { contentType: type, aggressive: false });
          }
        }
        return out;
      }
    };
    function mergeConfig(base, override) {
      const out = { ...base };
      for (const k of Object.keys(override)) {
        if (override[k] && typeof override[k] === "object" && !Array.isArray(override[k]) && base[k]) {
          out[k] = { ...base[k], ...override[k] };
        } else {
          out[k] = override[k];
        }
      }
      return out;
    }
    module2.exports = { Pipeline, DEFAULT_CONFIG };
  }
});

// ../nodejs_optimizer/src/metrics.js
var require_metrics = __commonJS({
  "../nodejs_optimizer/src/metrics.js"(exports2, module2) {
    "use strict";
    var Metrics = class {
      constructor() {
        this.reset();
      }
      reset() {
        this.counters = {
          requests: 0,
          cacheHits: 0,
          cacheMisses: 0,
          exactCacheHits: 0,
          semanticCacheHits: 0,
          truncations: 0,
          summarizations: 0,
          errors: 0
        };
        this.histograms = {
          beforeTokens: new Histogram(),
          afterTokens: new Histogram(),
          savedTokens: new Histogram(),
          savedPercent: new Histogram(),
          latencyMs: new Histogram()
        };
        this.byModel = /* @__PURE__ */ new Map();
        this.startedAt = Date.now();
      }
      record(event) {
        this.counters.requests++;
        if (event.cacheHit) {
          this.counters.cacheHits++;
          if (event.cacheType === "exact") this.counters.exactCacheHits++;
          else if (event.cacheType === "semantic") this.counters.semanticCacheHits++;
        } else if (event.cacheChecked) {
          this.counters.cacheMisses++;
        }
        if (event.stats) {
          if (typeof event.stats.beforeTokens === "number") this.histograms.beforeTokens.add(event.stats.beforeTokens);
          if (typeof event.stats.afterTokens === "number") this.histograms.afterTokens.add(event.stats.afterTokens);
          if (typeof event.stats.savedTokens === "number") this.histograms.savedTokens.add(event.stats.savedTokens);
          if (typeof event.stats.savedPercent === "number") this.histograms.savedPercent.add(event.stats.savedPercent);
          for (const step of event.stats.steps || []) {
            if (step.name === "truncation" && step.truncated) this.counters.truncations++;
            if (step.name === "history" && step.summarized > 0) this.counters.summarizations++;
          }
        }
        if (typeof event.latencyMs === "number") this.histograms.latencyMs.add(event.latencyMs);
        if (event.error) this.counters.errors++;
        if (event.model) {
          let m = this.byModel.get(event.model);
          if (!m) {
            m = { requests: 0, savedTokens: 0, cacheHits: 0 };
            this.byModel.set(event.model, m);
          }
          m.requests++;
          if (event.stats && event.stats.savedTokens) m.savedTokens += event.stats.savedTokens;
          if (event.cacheHit) m.cacheHits++;
        }
      }
      snapshot() {
        const total = this.counters.cacheHits + this.counters.cacheMisses;
        return {
          uptimeMs: Date.now() - this.startedAt,
          counters: { ...this.counters },
          cacheHitRate: total === 0 ? 0 : this.counters.cacheHits / total,
          histograms: {
            beforeTokens: this.histograms.beforeTokens.summary(),
            afterTokens: this.histograms.afterTokens.summary(),
            savedTokens: this.histograms.savedTokens.summary(),
            savedPercent: this.histograms.savedPercent.summary(),
            latencyMs: this.histograms.latencyMs.summary()
          },
          byModel: Object.fromEntries(this.byModel)
        };
      }
    };
    var Histogram = class {
      constructor(capacity = 1024) {
        this.cap = capacity;
        this.values = [];
        this.sum = 0;
        this.count = 0;
        this.min = Infinity;
        this.max = -Infinity;
      }
      add(v) {
        if (typeof v !== "number" || !isFinite(v)) return;
        this.sum += v;
        this.count++;
        if (v < this.min) this.min = v;
        if (v > this.max) this.max = v;
        if (this.values.length < this.cap) this.values.push(v);
        else this.values[Math.floor(Math.random() * this.cap)] = v;
      }
      summary() {
        if (this.count === 0) return { count: 0, mean: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
        const sorted = this.values.slice().sort((a, b) => a - b);
        const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
        return {
          count: this.count,
          mean: this.sum / this.count,
          p50: q(0.5),
          p95: q(0.95),
          p99: q(0.99),
          min: this.min,
          max: this.max
        };
      }
    };
    module2.exports = { Metrics, Histogram };
  }
});

// ../nodejs_optimizer/src/cache/exactCache.js
var require_exactCache = __commonJS({
  "../nodejs_optimizer/src/cache/exactCache.js"(exports2, module2) {
    "use strict";
    var { stableHash } = require_hash();
    var LRUBackend = class {
      constructor({ maxEntries = 1e3 } = {}) {
        this.max = maxEntries;
        this.store = /* @__PURE__ */ new Map();
        this.expiries = /* @__PURE__ */ new Map();
      }
      async get(key) {
        const exp = this.expiries.get(key);
        if (exp != null && exp < Date.now()) {
          this.store.delete(key);
          this.expiries.delete(key);
          return void 0;
        }
        const v = this.store.get(key);
        if (v !== void 0) {
          this.store.delete(key);
          this.store.set(key, v);
        }
        return v;
      }
      async set(key, value, ttlMs) {
        if (this.store.size >= this.max && !this.store.has(key)) {
          const oldest = this.store.keys().next().value;
          if (oldest !== void 0) {
            this.store.delete(oldest);
            this.expiries.delete(oldest);
          }
        }
        this.store.set(key, value);
        if (ttlMs && ttlMs > 0) this.expiries.set(key, Date.now() + ttlMs);
      }
      async delete(key) {
        this.store.delete(key);
        this.expiries.delete(key);
      }
      async size() {
        return this.store.size;
      }
      async clear() {
        this.store.clear();
        this.expiries.clear();
      }
    };
    var ExactCache = class {
      /**
       * @param {object} [opts]
       * @param {object} [opts.backend] custom backend
       * @param {number} [opts.maxEntries=1000]
       * @param {number} [opts.ttlMs] default TTL
       * @param {string} [opts.namespace] prefix for keys
       */
      constructor(opts = {}) {
        this.backend = opts.backend || new LRUBackend({ maxEntries: opts.maxEntries });
        this.ttlMs = opts.ttlMs;
        this.namespace = opts.namespace || "";
        this.stats = { hits: 0, misses: 0, sets: 0 };
      }
      /**
       * Build cache key from a request shape. Considers messages, model, and
       * relevant sampling params (temperature=0 only — higher temps shouldn't be cached).
       */
      buildKey(request) {
        const canonical = {
          model: request.model,
          messages: request.messages,
          tools: request.tools,
          response_format: request.response_format
          // intentionally exclude: max_tokens, stream, user metadata
        };
        return this.namespace + ":" + stableHash(canonical);
      }
      /**
       * Should this request even be cached? We avoid caching when:
       *  - temperature > 0 (or absent and model is non-deterministic)
       *  - request has tools that may have side effects
       *  - explicit `cache: false` on request metadata
       */
      isCacheable(request) {
        if (request._cache === false) return false;
        if (request.cache === false) return false;
        const t = request.temperature;
        if (t !== void 0 && t !== null && t > 0) return false;
        return true;
      }
      async get(request) {
        if (!this.isCacheable(request)) {
          this.stats.misses++;
          return void 0;
        }
        const key = this.buildKey(request);
        const v = await this.backend.get(key);
        if (v === void 0) this.stats.misses++;
        else this.stats.hits++;
        return v;
      }
      async set(request, response, ttlMs) {
        if (!this.isCacheable(request)) return;
        const key = this.buildKey(request);
        await this.backend.set(key, response, ttlMs ?? this.ttlMs);
        this.stats.sets++;
      }
      async invalidate(request) {
        const key = this.buildKey(request);
        await this.backend.delete(key);
      }
      async clear() {
        if (typeof this.backend.clear === "function") await this.backend.clear();
      }
      getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
          ...this.stats,
          hitRate: total === 0 ? 0 : this.stats.hits / total
        };
      }
    };
    module2.exports = { ExactCache, LRUBackend };
  }
});

// ../nodejs_optimizer/src/cache/semanticCache.js
var require_semanticCache = __commonJS({
  "../nodejs_optimizer/src/cache/semanticCache.js"(exports2, module2) {
    "use strict";
    var { minHashSketch, jaccardSimilarity, cosineSimilarity, stableHash } = require_hash();
    var DEFAULT_THRESHOLD = 0.92;
    var DEFAULT_MAX_ENTRIES = 500;
    var SemanticCache = class {
      /**
       * @param {object} [opts]
       * @param {number} [opts.threshold=0.92]
       * @param {number} [opts.maxEntries=500]
       * @param {(text: string) => Promise<number[]>} [opts.embed]
       * @param {number} [opts.ttlMs]
       * @param {string} [opts.namespace]
       * @param {(queryText: string, cachedQueryText: string) => Promise<boolean>} [opts.verify]
       * @param {number} [opts.verifiedThreshold=0.85]
       */
      constructor(opts = {}) {
        this.threshold = opts.threshold ?? DEFAULT_THRESHOLD;
        this.maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
        this.embed = opts.embed || null;
        this.ttlMs = opts.ttlMs;
        this.namespace = opts.namespace || "";
        this.verify = opts.verify || null;
        this.verifiedThreshold = opts.verifiedThreshold ?? 0.85;
        this.buckets = /* @__PURE__ */ new Map();
        this.stats = { hits: 0, misses: 0, sets: 0, exactHits: 0, fuzzyHits: 0, verifiedHits: 0, rejectedHits: 0, verifyErrors: 0 };
      }
      isCacheable(request) {
        if (request._cache === false || request.cache === false) return false;
        if (request.temperature !== void 0 && request.temperature > 0.3) return false;
        return true;
      }
      contextFingerprint(request) {
        const sys = (request.messages || []).filter((m) => m.role === "system");
        return stableHash({
          model: request.model,
          tools: request.tools,
          system: sys,
          response_format: request.response_format
        });
      }
      queryContent(request) {
        const msgs = (request.messages || []).filter((m) => m.role !== "system");
        return msgs.map((m) => {
          const role = m.role;
          const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
          return `${role}: ${text}`;
        }).join("\n");
      }
      async get(request) {
        if (!this.isCacheable(request)) {
          this.stats.misses++;
          return void 0;
        }
        const fingerprint = this.namespace + ":" + this.contextFingerprint(request);
        const bucket = this.buckets.get(fingerprint);
        if (!bucket || bucket.length === 0) {
          this.stats.misses++;
          return void 0;
        }
        const queryText = this.queryContent(request);
        const now = Date.now();
        for (let i = bucket.length - 1; i >= 0; i--) {
          if (bucket[i].expiresAt && bucket[i].expiresAt < now) bucket.splice(i, 1);
        }
        for (const entry of bucket) {
          if (entry.contentText === queryText) {
            this.stats.hits++;
            this.stats.exactHits++;
            return { response: entry.response, similarity: 1, exact: true };
          }
        }
        let best = null;
        let bestScore = 0;
        if (this.embed) {
          const queryEmbed = await this.embed(queryText);
          for (const entry of bucket) {
            if (!entry.embedding) continue;
            const score = embedCosine(queryEmbed, entry.embedding);
            if (score > bestScore) {
              bestScore = score;
              best = entry;
            }
          }
        } else {
          const querySketch = minHashSketch(queryText);
          for (const entry of bucket) {
            const jac = jaccardSimilarity(querySketch, entry.sketch);
            const cos = cosineSimilarity(queryText, entry.contentText);
            const score = (jac + cos) / 2;
            if (score > bestScore) {
              bestScore = score;
              best = entry;
            }
          }
        }
        const effectiveThreshold = this.verify ? this.verifiedThreshold : this.threshold;
        if (best && bestScore >= effectiveThreshold) {
          if (this.verify) {
            const qh = stableHash(queryText);
            if (best.rejectedQueries && best.rejectedQueries.has(qh)) {
              this.stats.misses++;
              return void 0;
            }
            let ok = false;
            try {
              ok = await this.verify(queryText, best.contentText);
            } catch {
              this.stats.verifyErrors++;
              this.stats.misses++;
              return void 0;
            }
            if (!ok) {
              this.stats.rejectedHits++;
              this.stats.misses++;
              if (!best.rejectedQueries) best.rejectedQueries = /* @__PURE__ */ new Set();
              if (best.rejectedQueries.size < 64) best.rejectedQueries.add(qh);
              return void 0;
            }
            this.stats.verifiedHits++;
          }
          this.stats.hits++;
          this.stats.fuzzyHits++;
          return { response: best.response, similarity: bestScore, exact: false };
        }
        this.stats.misses++;
        return void 0;
      }
      async set(request, response, ttlMs) {
        if (!this.isCacheable(request)) return;
        const fingerprint = this.namespace + ":" + this.contextFingerprint(request);
        let bucket = this.buckets.get(fingerprint);
        if (!bucket) {
          if (this.buckets.size >= this.maxEntries) {
            const oldest = this.buckets.keys().next().value;
            if (oldest !== void 0) this.buckets.delete(oldest);
          }
          bucket = [];
          this.buckets.set(fingerprint, bucket);
        }
        const queryText = this.queryContent(request);
        const entry = {
          contentText: queryText,
          sketch: minHashSketch(queryText),
          embedding: this.embed ? await this.embed(queryText) : null,
          response,
          expiresAt: ttlMs ?? this.ttlMs ? Date.now() + (ttlMs ?? this.ttlMs) : null
        };
        if (bucket.length >= 32) bucket.shift();
        bucket.push(entry);
        this.stats.sets++;
      }
      async clear() {
        this.buckets.clear();
      }
      getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
          ...this.stats,
          hitRate: total === 0 ? 0 : this.stats.hits / total,
          bucketCount: this.buckets.size
        };
      }
    };
    function embedCosine(a, b) {
      if (!a || !b || a.length !== b.length) return 0;
      let dot = 0;
      let na = 0;
      let nb = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
      }
      if (na === 0 || nb === 0) return 0;
      return dot / (Math.sqrt(na) * Math.sqrt(nb));
    }
    module2.exports = { SemanticCache };
  }
});

// ../nodejs_optimizer/src/optimizers/pyAstCompressor.js
var require_pyAstCompressor = __commonJS({
  "../nodejs_optimizer/src/optimizers/pyAstCompressor.js"(exports2, module2) {
    "use strict";
    function compress(text, opts = {}) {
      const originalLen = typeof text === "string" ? text.length : 0;
      if (!text || typeof text !== "string") {
        return { text, originalLen, newLen: originalLen, savedBytes: 0, mode: "noop", dropped: 0 };
      }
      const placeholder = opts.placeholder != null ? opts.placeholder : "# ...";
      const mkPlaceholder = typeof placeholder === "function" ? placeholder : () => placeholder;
      const rawLines = text.split("\n");
      const n = rawLines.length;
      const meta = rawLines.map((line) => {
        const trimmed = line.trim();
        const indent = indentWidth(line);
        return { line, trimmed, indent, blank: trimmed.length === 0 };
      });
      const keep = new Array(n).fill(true);
      let i = 0;
      while (i < n) {
        const m = meta[i];
        if (!m.blank && isDefStart(m.trimmed)) {
          const defIndent = m.indent;
          const sigEnd = findSignatureEnd(rawLines, i);
          let b = sigEnd + 1;
          b = skipLeadingDocstring(rawLines, meta, b, n, defIndent);
          i = dropBody(rawLines, meta, keep, b, n, defIndent);
          continue;
        }
        i++;
      }
      if (keep.every(Boolean)) {
        return { text, originalLen, newLen: originalLen, savedBytes: 0, mode: "py-regex", dropped: 0 };
      }
      const out = [];
      let dropped = 0;
      let k = 0;
      while (k < n) {
        if (keep[k]) {
          out.push(rawLines[k]);
          k++;
          continue;
        }
        let j = k;
        while (j < n && !keep[j]) j++;
        const runLines = rawLines.slice(k, j);
        let runIndent = "";
        for (const rl of runLines) {
          if (rl.trim().length) {
            runIndent = rl.slice(0, indentWidth(rl));
            break;
          }
        }
        const runText = runLines.join("\n");
        const ph = mkPlaceholder(runText);
        out.push(runIndent + ph);
        dropped++;
        k = j;
      }
      const outText = out.join("\n");
      if (outText.length >= originalLen) {
        return { text, originalLen, newLen: originalLen, savedBytes: 0, mode: "py-regex", dropped: 0 };
      }
      return {
        text: outText,
        originalLen,
        newLen: outText.length,
        savedBytes: originalLen - outText.length,
        mode: "py-regex",
        dropped
      };
    }
    function indentWidth(line) {
      let i = 0;
      while (i < line.length && (line[i] === " " || line[i] === "	")) i++;
      return i;
    }
    function isDefStart(trimmed) {
      return /^(?:async\s+def|def)\b/.test(trimmed);
    }
    function isClassStart(trimmed) {
      return /^class\b/.test(trimmed);
    }
    function isDecorator(trimmed) {
      return trimmed.startsWith("@");
    }
    function findSignatureEnd(lines, start) {
      let depth = 0;
      for (let i = start; i < lines.length; i++) {
        const code = stripStringsAndComments(lines[i]);
        for (const ch of code) {
          if (ch === "(" || ch === "[" || ch === "{") depth++;
          else if (ch === ")" || ch === "]" || ch === "}") depth--;
        }
        if (depth <= 0) {
          const trimmedCode = code.replace(/#.*$/, "").trimEnd();
          if (trimmedCode.endsWith(":")) return i;
        }
      }
      return start;
    }
    function skipLeadingDocstring(lines, meta, b, n, defIndent) {
      let i = b;
      while (i < n && meta[i].blank) i++;
      if (i >= n) return b;
      const t = meta[i].trimmed;
      if (meta[i].indent <= defIndent) return b;
      const m = t.match(/^([rRbBuUfF]*)("""|''')/);
      if (!m) return b;
      const quote = m[2];
      const afterOpen = t.slice(m[0].length);
      if (afterOpen.includes(quote)) return i + 1;
      for (let j = i + 1; j < n; j++) {
        if (meta[j].line.includes(quote)) return j + 1;
      }
      return n;
    }
    function dropBody(lines, meta, keep, b, n, defIndent) {
      let i = b;
      while (i < n) {
        const m = meta[i];
        if (m.blank) {
          i++;
          continue;
        }
        if (m.indent <= defIndent) return i;
        if (isDecorator(m.trimmed)) {
          let j = i;
          while (j < n && !meta[j].blank && isDecorator(meta[j].trimmed)) j++;
          i = j;
          continue;
        }
        if (isDefStart(m.trimmed) || isClassStart(m.trimmed)) {
          const nestedIndent = m.indent;
          const sigEnd = findSignatureEnd(lines, i);
          let nb = sigEnd + 1;
          if (isDefStart(m.trimmed)) {
            nb = skipLeadingDocstring(lines, meta, nb, n, nestedIndent);
          }
          i = dropBody(lines, meta, keep, nb, n, nestedIndent);
          continue;
        }
        keep[i] = false;
        i++;
      }
      return i;
    }
    function stripStringsAndComments(line) {
      let out = "";
      let i = 0;
      const nn = line.length;
      while (i < nn) {
        const c = line[i];
        if (c === "#") break;
        if ((c === '"' || c === "'") && line[i + 1] === c && line[i + 2] === c) {
          const q = c + c + c;
          const end = line.indexOf(q, i + 3);
          if (end === -1) {
            i = nn;
            break;
          }
          i = end + 3;
          continue;
        }
        if (c === '"' || c === "'") {
          i++;
          while (i < nn && line[i] !== c) {
            if (line[i] === "\\") i++;
            i++;
          }
          i++;
          continue;
        }
        out += c;
        i++;
      }
      return out;
    }
    module2.exports = { compress };
  }
});

// ../nodejs_optimizer/src/strategies/ccr.js
var require_ccr = __commonJS({
  "../nodejs_optimizer/src/strategies/ccr.js"(exports2, module2) {
    "use strict";
    var crypto = require("crypto");
    var DEFAULT_TTL_MS = 2 * 60 * 60 * 1e3;
    var DEFAULT_MAX_ENTRIES = 1e3;
    var CCRStore = class {
      constructor(opts = {}) {
        this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
        this.maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
        this.markerPrefix = opts.markerPrefix ?? "agentone:ref:";
        this._now = opts.now || Date.now;
        this.store = /* @__PURE__ */ new Map();
        this._stats = { lostRetrievals: 0, ambiguousRetrievals: 0 };
      }
      _key(sessionId, id) {
        return `${sessionId || ""}:${id}`;
      }
      /**
       * Compress a chunk: returns a short marker that replaces it in the prompt,
       * and stores the original.
       *
       * @param {string} original
       * @param {object} [opts]
       * @param {string} [opts.summary] short summary embedded in the marker
       * @param {string} [opts.type] e.g. 'json', 'log', 'code'
       * @param {string} [opts.sessionId] optional session namespace
       * @returns {{ id: string, marker: string }}
       */
      store_(original, opts = {}) {
        const id = shortHash(original);
        this._evictIfNeeded();
        this.store.set(this._key(opts.sessionId, id), {
          content: original,
          summary: opts.summary,
          type: opts.type,
          sessionId: opts.sessionId || "",
          lastTouched: this._now()
        });
        const len = original.length;
        const sum = opts.summary ? ` "${truncate(opts.summary, 60)}"` : "";
        const type = opts.type ? ` ${opts.type}` : "";
        const marker = `[${len} chars compressed${type}${sum} id=${id}]`;
        return { id, marker };
      }
      /** Get entry by internal key if alive; refreshes idle timer. */
      _touchGet(key) {
        const entry = this.store.get(key);
        if (!entry) return void 0;
        if (this.ttlMs && this._now() - entry.lastTouched > this.ttlMs) {
          this.store.delete(key);
          return void 0;
        }
        entry.lastTouched = this._now();
        return entry;
      }
      /** Resolve an id to a live entry without touching stats. Prunes expired ghosts on the way. */
      _resolve(id, sessionId) {
        if (sessionId) {
          const e = this._touchGet(this._key(sessionId, id));
          if (e) return e;
        }
        const eDefault = this._touchGet(this._key("", id));
        if (eDefault) return eDefault;
        const suffix = ":" + id;
        const liveKeys = [];
        for (const k of [...this.store.keys()]) {
          if (!k.endsWith(suffix)) continue;
          const entry = this.store.get(k);
          if (this.ttlMs && this._now() - entry.lastTouched > this.ttlMs) {
            this.store.delete(k);
            continue;
          }
          liveKeys.push(k);
        }
        if (liveKeys.length === 1) return this._touchGet(liveKeys[0]);
        if (liveKeys.length > 1) return { _ambiguous: true };
        return void 0;
      }
      /**
       * Retrieve original content by id. Returns undefined if expired/missing.
       * Resolves: sessionId (if provided) → default namespace → unique cross-session match
       * @param {string} id
       * @param {object} [opts]
       * @param {string} [opts.sessionId] optional session namespace
       * @returns {string|undefined}
       */
      retrieve(id, opts = {}) {
        const r = this._resolve(id, opts.sessionId);
        if (r && r._ambiguous) {
          this._stats.ambiguousRetrievals++;
          this._stats.lostRetrievals++;
          return void 0;
        }
        if (r) return r.content;
        this._stats.lostRetrievals++;
        return void 0;
      }
      /** Non-counting lookup used by expand() — best-effort unrolling must not pollute retrieval stats. */
      peek(id, opts = {}) {
        const r = this._resolve(id, opts.sessionId);
        if (!r || r._ambiguous) return void 0;
        return r.content;
      }
      /**
       * End a session, releasing all entries in that session namespace.
       * @param {string} sessionId
       * @returns {number} number of entries released
       */
      endSession(sessionId) {
        let released = 0;
        for (const [k, v] of this.store) {
          if (v.sessionId === sessionId) {
            this.store.delete(k);
            released++;
          }
        }
        return released;
      }
      /**
       * Parse markers out of a text and return [{ id, marker, position }].
       * Useful for unrolling on the response side, or for debugging.
       */
      findMarkers(text) {
        const re = /\[(\d+) chars compressed(?:\s+(\w+))?(?:\s+"([^"]*)")?\s+id=([a-f0-9]+)\]/g;
        const out = [];
        let m;
        while ((m = re.exec(text)) !== null) {
          out.push({
            marker: m[0],
            length: parseInt(m[1], 10),
            type: m[2],
            summary: m[3],
            id: m[4],
            position: m.index
          });
        }
        return out;
      }
      /**
       * Expand markers in text by replacing each with the original content
       * (if still in the cache). Useful for fully unrolling for offline debug.
       */
      expand(text) {
        const markers = this.findMarkers(text);
        if (markers.length === 0) return text;
        let out = text;
        for (let i = markers.length - 1; i >= 0; i--) {
          const original = this.peek(markers[i].id);
          if (original !== void 0) {
            out = out.slice(0, markers[i].position) + original + out.slice(markers[i].position + markers[i].marker.length);
          }
        }
        return out;
      }
      /**
       * Get the tool definition that lets a model retrieve compressed content.
       * Matches OpenAI / Anthropic tool schemas.
       *
       * Inject this into the tools array of any request that has CCR markers.
       */
      getToolDefinition() {
        return {
          type: "function",
          function: {
            name: "retrieve_compressed",
            description: "Retrieve the original content for a compressed block. Use the id from a [chars compressed id=...] marker in the prompt.",
            parameters: {
              type: "object",
              properties: {
                id: { type: "string", description: "The id from a compressed marker." }
              },
              required: ["id"]
            }
          }
        };
      }
      stats() {
        return { size: this.store.size, maxEntries: this.maxEntries, ...this._stats };
      }
      clear() {
        this.store.clear();
      }
      _evictIfNeeded() {
        if (this.store.size < this.maxEntries) return;
        let oldestKey = null;
        let oldestT = Infinity;
        for (const [k, v] of this.store) {
          if (v.lastTouched < oldestT) {
            oldestT = v.lastTouched;
            oldestKey = k;
          }
        }
        if (oldestKey) this.store.delete(oldestKey);
      }
    };
    function shortHash(s) {
      return crypto.createHash("sha256").update(s).digest("hex").slice(0, 8);
    }
    function truncate(s, n) {
      if (!s) return "";
      if (s.length <= n) return s;
      return s.slice(0, n - 1) + "\u2026";
    }
    module2.exports = { CCRStore };
  }
});

// ../nodejs_optimizer/src/strategies/freezeLedger.js
var require_freezeLedger = __commonJS({
  "../nodejs_optimizer/src/strategies/freezeLedger.js"(exports2, module2) {
    "use strict";
    var { stableHash } = require_hash();
    function contentString(content) {
      if (typeof content === "string") return content;
      return stableHash(content);
    }
    var FreezeLedger = class {
      constructor(opts = {}) {
        this.maxConversations = opts.maxConversations ?? 500;
        this.backend = opts.backend || null;
        this._now = opts.now || Date.now;
        this._entries = /* @__PURE__ */ new Map();
        this._conversations = /* @__PURE__ */ new Map();
      }
      chainKeys(system, messages) {
        const keys = [];
        let prev = stableHash({ sys: system || "" });
        for (const m of messages || []) {
          if (m.role === "system") continue;
          prev = stableHash({ p: prev, c: contentString(m.content) });
          keys.push(prev);
        }
        return keys;
      }
      _touchConversation(conversationId) {
        if (!this._conversations.has(conversationId)) {
          this._conversations.set(conversationId, /* @__PURE__ */ new Set());
        } else {
          const set = this._conversations.get(conversationId);
          this._conversations.delete(conversationId);
          this._conversations.set(conversationId, set);
        }
        return this._conversations.get(conversationId);
      }
      async _evictConversations() {
        while (this._conversations.size > this.maxConversations) {
          const oldestId = this._conversations.keys().next().value;
          const set = this._conversations.get(oldestId);
          this._conversations.delete(oldestId);
          for (const k of set) {
            this._entries.delete(k);
            if (this.backend) await this.backend.delete(k);
          }
        }
      }
      async _getRaw(chainKey) {
        if (this.backend) {
          const v = await this.backend.get(chainKey);
          return v;
        }
        return this._entries.get(chainKey);
      }
      async getFrozen(chainKey) {
        const v = await this._getRaw(chainKey);
        if (v != null && v.conversationId !== void 0) this._touchConversation(v.conversationId);
        return v;
      }
      async lookupPrefix(chainKeys) {
        let n = 0;
        for (const k of chainKeys) {
          const v = await this._getRaw(k);
          if (v != null) {
            if (v.conversationId !== void 0) this._touchConversation(v.conversationId);
            n++;
          } else break;
        }
        return n;
      }
      async commit(chainKey, frozenBytes, tokenCount, turnIndex, conversationId) {
        const convId = conversationId ?? chainKey;
        const entry = { frozenBytes, tokenCount, turnIndex, lastSeen: this._now(), conversationId: convId };
        this._entries.set(chainKey, entry);
        if (this.backend) await this.backend.set(chainKey, entry);
        this._touchConversation(convId).add(chainKey);
        await this._evictConversations();
      }
      async resetFrom(chainKeys, fromIndex) {
        for (let i = fromIndex; i < chainKeys.length; i++) {
          const k = chainKeys[i];
          const e = this._entries.get(k) || (this.backend ? await this.backend.get(k) : void 0);
          this._entries.delete(k);
          if (this.backend) await this.backend.delete(k);
          if (e && e.conversationId !== void 0) {
            const set = this._conversations.get(e.conversationId);
            if (set) {
              set.delete(k);
              if (set.size === 0) this._conversations.delete(e.conversationId);
            }
          }
        }
      }
      stats() {
        let frozenEntries = 0;
        for (const set of this._conversations.values()) frozenEntries += set.size;
        return { conversations: this._conversations.size, frozenEntries };
      }
    };
    module2.exports = { FreezeLedger };
  }
});

// ../nodejs_optimizer/src/strategies/breakpointPlanner.js
var require_breakpointPlanner = __commonJS({
  "../nodejs_optimizer/src/strategies/breakpointPlanner.js"(exports2, module2) {
    "use strict";
    var { countTokens } = require_tokenCounter();
    function contentTokens(content, model) {
      if (typeof content === "string") return countTokens(content, model);
      if (Array.isArray(content)) {
        let t = 0;
        for (const b of content) {
          if (typeof b === "string") t += countTokens(b, model);
          else if (b && typeof b.text === "string") t += countTokens(b.text, model);
        }
        return t;
      }
      return 0;
    }
    function hasMarker(content) {
      if (Array.isArray(content)) return content.some((b) => b && b.cache_control);
      return false;
    }
    function markMessage(message, ttl) {
      const cc = { type: "ephemeral", ttl };
      if (typeof message.content === "string") {
        return { ...message, content: [{ type: "text", text: message.content, cache_control: cc }] };
      }
      if (Array.isArray(message.content) && message.content.length) {
        const lastIdx = message.content.length - 1;
        const last = message.content[lastIdx];
        if (!last || typeof last !== "object") return message;
        const content = message.content.map((b, i) => i === lastIdx ? { ...b, cache_control: cc } : b);
        return { ...message, content };
      }
      return message;
    }
    function planBreakpoints(opts) {
      const { messages, model, pricing, expectedReads, ttl, alreadyMarked } = opts;
      const skip = (reason) => ({ messages, breakpointsPlaced: 0, plannerSkipped: true, ttl, reason });
      if (!pricing.explicitBreakpoints) return skip("no-explicit-breakpoints");
      if (alreadyMarked) return skip("caller-marked");
      const w = ttl === "1h" ? pricing.writeMult1h : pricing.writeMult5m;
      const breakEven = (w - 1) / (1 - pricing.readMult);
      if (expectedReads < breakEven) return skip("below-break-even");
      const min = pricing.minCacheablePrefixTokens;
      const lookback = pricing.blockLookback === Infinity ? messages.length : pricing.blockLookback;
      let running = 0;
      let lastSystemIdx = -1;
      const clearedAt = [];
      for (let i = 0; i < messages.length; i++) {
        running += contentTokens(messages[i].content, model);
        if (messages[i].role === "system") lastSystemIdx = i;
        if (running >= min) clearedAt.push(i);
      }
      if (clearedAt.length === 0) return { messages, breakpointsPlaced: 0, plannerSkipped: false, ttl };
      const positions = /* @__PURE__ */ new Set();
      if (lastSystemIdx >= 0 && running >= min && lastSystemIdx >= clearedAt[0]) positions.add(lastSystemIdx);
      positions.add(messages.length - 1);
      for (let i = messages.length - 1 - lookback; i >= clearedAt[0]; i -= lookback) {
        if (positions.size >= pricing.maxBreakpoints) break;
        positions.add(i);
      }
      let chosen = [...positions].filter((i) => i >= clearedAt[0]).sort((a, b) => a - b);
      if (chosen.length > pricing.maxBreakpoints) chosen = chosen.slice(-pricing.maxBreakpoints);
      const out = messages.slice();
      let placed = 0;
      for (const i of chosen) {
        if (hasMarker(out[i].content)) continue;
        const marked = markMessage(out[i], ttl);
        if (marked !== out[i]) {
          out[i] = marked;
          placed++;
        }
      }
      return { messages: out, breakpointsPlaced: placed, plannerSkipped: false, ttl };
    }
    module2.exports = { planBreakpoints };
  }
});

// ../nodejs_optimizer/src/strategies/calibrator.js
var require_calibrator = __commonJS({
  "../nodejs_optimizer/src/strategies/calibrator.js"(exports2, module2) {
    "use strict";
    var FIVE_MIN_MS = 5 * 60 * 1e3;
    var Calibrator = class {
      constructor(opts = {}) {
        this.seedRemaining = opts.expectedRemainingTurns ?? 5;
        this.alpha = opts.alpha ?? 0.3;
        this._now = opts.now || Date.now;
        this._ns = /* @__PURE__ */ new Map();
      }
      _state(ns) {
        let s = this._ns.get(ns);
        if (!s) {
          s = { remaining: this.seedRemaining, reads: 1, gapMs: 0, lastSeen: null };
          this._ns.set(ns, s);
        }
        return s;
      }
      _ema(prev, sample) {
        return prev + this.alpha * (sample - prev);
      }
      observe(ns, ev) {
        const s = this._state(ns);
        if (typeof ev.turnIndex === "number") s.remaining = this._ema(s.remaining, Math.max(1, ev.turnIndex));
        const readThisTurn = ev.cacheReadTokens > 0 ? 1 : 0;
        s.reads = this._ema(s.reads, readThisTurn);
        const now = this._now();
        if (s.lastSeen !== null) s.gapMs = this._ema(s.gapMs, now - s.lastSeen);
        s.lastSeen = now;
        const cacheMissAnomaly = ev.expectedReadTokens > 0 && ev.cacheReadTokens < 0.5 * ev.expectedReadTokens;
        return { cacheMissAnomaly };
      }
      expectedRemainingTurns(ns) {
        return this._state(ns).remaining;
      }
      expectedReads(ns) {
        return this._state(ns).reads;
      }
      interRequestGapMs(ns) {
        return this._state(ns).gapMs;
      }
      chooseTtl(ns, pricing) {
        const s = this._state(ns);
        const expectedFutureReads = s.reads * s.remaining;
        if (s.gapMs > FIVE_MIN_MS && expectedFutureReads >= 3) return "1h";
        return "5m";
      }
    };
    module2.exports = { Calibrator };
  }
});

// ../nodejs_optimizer/src/strategies/cacheEconomics.js
var require_cacheEconomics = __commonJS({
  "../nodejs_optimizer/src/strategies/cacheEconomics.js"(exports2, module2) {
    "use strict";
    var { getPricing } = require_pricingModel();
    var { FreezeLedger } = require_freezeLedger();
    var { gateMutation } = require_mutationGate();
    var { planBreakpoints } = require_breakpointPlanner();
    var { Calibrator } = require_calibrator();
    var { countTokens } = require_tokenCounter();
    function systemString(messages) {
      return (messages || []).filter((m) => m.role === "system").map((m) => typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n");
    }
    function contentTokens(content, model) {
      if (typeof content === "string") return countTokens(content, model);
      if (Array.isArray(content)) return content.reduce((t, b) => t + (typeof b === "string" ? countTokens(b, model) : b && b.text ? countTokens(b.text, model) : 0), 0);
      return 0;
    }
    function requestHasMarkers(messages) {
      return (messages || []).some((m) => Array.isArray(m.content) && m.content.some((b) => b && b.cache_control));
    }
    var CacheEconomicsScheduler = class {
      constructor(config = {}, deps = {}) {
        this.config = {
          enabled: false,
          expectedRemainingTurns: 5,
          ttl: "auto",
          manageBreakpoints: true,
          maxConversations: 500,
          pricing: void 0,
          ...config
        };
        this.ledger = new FreezeLedger({ maxConversations: this.config.maxConversations, backend: deps.backend, now: deps.now });
        this.calibrator = new Calibrator({ expectedRemainingTurns: this.config.expectedRemainingTurns, now: deps.now });
      }
      _namespace(request) {
        return request && (request.user || request.metadata && request.metadata.namespace) || "default";
      }
      gate({ model, namespace, tokensSaved, invalidatedPrefixTokens, ttl, forced }) {
        const pricing = getPricing(model, this.config.pricing);
        return gateMutation({
          pricing,
          tokensSaved,
          invalidatedPrefixTokens,
          expectedRemainingTurns: this.calibrator.expectedRemainingTurns(namespace),
          ttl: ttl || "5m",
          forced
        });
      }
      async plan(request, { transformTail }) {
        if (!this.config.enabled) return { request };
        const decisions = {
          name: "cacheEconomics",
          frozenMessages: 0,
          tailMessages: 0,
          mutationsAllowed: 0,
          mutationsBlocked: 0,
          breakpointsPlaced: 0,
          plannerSkipped: false,
          estSavedUSD: 0,
          schedulerErrors: 0,
          cacheMissAnomaly: 0
        };
        try {
          const model = request.model;
          const ns = this._namespace(request);
          const pricing = getPricing(model, this.config.pricing);
          const messages = request.messages || [];
          const sys = systemString(messages);
          const nonSystem = messages.filter((m) => m.role !== "system");
          const keys = this.ledger.chainKeys(sys, nonSystem);
          const frozenLen = await this.ledger.lookupPrefix(keys);
          const outNonSystem = [];
          for (let i = 0; i < nonSystem.length; i++) {
            if (i < frozenLen) {
              const f = await this.ledger.getFrozen(keys[i]);
              outNonSystem.push(f ? { ...nonSystem[i], content: f.frozenBytes } : nonSystem[i]);
              decisions.frozenMessages++;
            } else {
              outNonSystem.push(nonSystem[i]);
            }
          }
          const tailOriginal = nonSystem.slice(frozenLen);
          const tailTransformed = transformTail(tailOriginal);
          decisions.tailMessages = tailTransformed.length;
          for (let i = 0; i < tailTransformed.length; i++) {
            const idx = frozenLen + i;
            outNonSystem[idx] = tailTransformed[i];
            const tok = contentTokens(tailTransformed[i].content, model);
            if (keys.length > 0) {
              await this.ledger.commit(keys[idx], tailTransformed[i].content, tok, idx, keys[0]);
            }
          }
          let ni = 0;
          let outMessages = messages.map((m) => m.role === "system" ? m : outNonSystem[ni++]);
          if (this.config.manageBreakpoints) {
            const ttl = this.config.ttl === "auto" ? this.calibrator.chooseTtl(ns, pricing) : this.config.ttl;
            const r = planBreakpoints({
              messages: outMessages,
              model,
              pricing,
              frozenTurnCount: frozenLen,
              expectedReads: this.calibrator.expectedReads(ns),
              ttl,
              alreadyMarked: requestHasMarkers(messages)
            });
            outMessages = r.messages;
            decisions.breakpointsPlaced = r.breakpointsPlaced;
            decisions.plannerSkipped = r.plannerSkipped;
          }
          return { request: { ...request, messages: outMessages }, decisions };
        } catch (err) {
          decisions.schedulerErrors++;
          return { request, decisions };
        }
      }
      async observe(request, usage) {
        if (!this.config.enabled || !usage) return;
        try {
          const ns = this._namespace(request);
          const nonSystem = (request.messages || []).filter((m) => m.role !== "system");
          const r = this.calibrator.observe(ns, {
            turnIndex: nonSystem.length,
            cacheReadTokens: usage.cache_read_input_tokens || 0,
            cacheCreationTokens: usage.cache_creation_input_tokens || 0,
            expectedReadTokens: usage._expectedReadTokens || 0
          });
          this._lastAnomaly = r.cacheMissAnomaly;
        } catch {
        }
      }
    };
    module2.exports = { CacheEconomicsScheduler };
  }
});

// ../nodejs_optimizer/src/strategies/signalCollector.js
var require_signalCollector = __commonJS({
  "../nodejs_optimizer/src/strategies/signalCollector.js"(exports2, module2) {
    "use strict";
    var FIELDS = ["tokensSavedRate", "revertRate", "lostRetrievalRate", "cacheMissAnomalyRate", "retryRate", "shadowLossRate"];
    function findStep(steps, name) {
      return (steps || []).find((s) => s.name === name);
    }
    var SignalCollector = class {
      constructor(opts = {}) {
        this.alpha = opts.alpha ?? 0.3;
        this._arms = /* @__PURE__ */ new Map();
      }
      _state(arm) {
        let s = this._arms.get(arm);
        if (!s) {
          s = {};
          for (const f of FIELDS) s[f] = 0;
          this._arms.set(arm, s);
        }
        return s;
      }
      _ema(prev, sample) {
        return prev + this.alpha * (sample - prev);
      }
      ingest(arm, { stats, external = {} }) {
        const s = this._state(arm);
        const steps = stats && stats.steps || [];
        const before = stats && stats.beforeTokens || 0;
        const saved = stats && stats.savedTokens || 0;
        const tg = findStep(steps, "tokenGuard") || {};
        const dict = findStep(steps, "dictionary") || {};
        const ce = findStep(steps, "cacheEconomics") || {};
        const samples = {
          tokensSavedRate: before > 0 ? Math.max(0, Math.min(1, saved / before)) : 0,
          revertRate: (tg.abbreviation || 0) + (tg.stopwords || 0) + (tg.whitespace || 0) + (dict.encodeReverts || 0),
          lostRetrievalRate: external.lostRetrievalDelta || 0,
          cacheMissAnomalyRate: ce.cacheMissAnomaly ? 1 : 0,
          retryRate: external.retry ? 1 : 0,
          shadowLossRate: external.shadowLoss ? 1 : 0
        };
        for (const f of FIELDS) s[f] = this._ema(s[f], samples[f]);
        return { ...s };
      }
      rates(arm) {
        return { ...this._state(arm) };
      }
    };
    module2.exports = { SignalCollector, FIELDS };
  }
});

// ../nodejs_optimizer/src/strategies/bandit.js
var require_bandit = __commonJS({
  "../nodejs_optimizer/src/strategies/bandit.js"(exports2, module2) {
    "use strict";
    function computeReward(rates, weights) {
      return weights.tokensSaved * rates.tokensSavedRate - weights.revert * rates.revertRate - weights.lostRetrieval * rates.lostRetrievalRate - weights.cacheMissAnomaly * rates.cacheMissAnomalyRate - weights.retry * rates.retryRate - weights.shadowLoss * rates.shadowLossRate;
    }
    var BanditController = class {
      /**
       * @param {Object} opts
       * @param {string[]} opts.levels - config levels to explore (e.g., ['conservative', 'balanced', 'aggressive'])
       * @param {number} opts.explore - initial exploration rate (default 0.1)
       * @param {number} opts.exploreMin - minimum exploration rate (default 0.02)
       * @param {number} opts.alpha - EMA learning rate (default 0.3)
       * @param {Function} opts.random - random() → [0,1) for deterministic tests (default Math.random)
       * @param {Object} opts.backend - optional { get(key), set(key, value) } for persistence
       * @param {number} opts.maxConversations - max arms to track; oldest (LRU) evicted when exceeded (default 500)
       */
      constructor(opts = {}) {
        this.levels = opts.levels || ["conservative", "balanced", "aggressive"];
        this.explore = opts.explore ?? 0.1;
        this.exploreMin = opts.exploreMin ?? 0.02;
        this.alpha = opts.alpha ?? 0.3;
        this._random = opts.random || Math.random;
        this.backend = opts.backend || null;
        this.maxConversations = opts.maxConversations ?? 500;
        this._arms = /* @__PURE__ */ new Map();
      }
      /**
       * Mark an arm as most-recently-used by deleting and re-inserting it.
       * @private
       */
      _touch(arm) {
        const s = this._arms.get(arm);
        if (s) {
          this._arms.delete(arm);
          this._arms.set(arm, s);
        }
      }
      /**
       * Get or initialize state for an arm.
       * @private
       */
      _state(arm) {
        let s = this._arms.get(arm);
        if (!s) {
          s = { levels: {} };
          for (const l of this.levels) {
            s.levels[l] = { pulls: 0, meanReward: 0 };
          }
          this._arms.set(arm, s);
          if (this._arms.size > this.maxConversations) {
            const oldest = this._arms.keys().next().value;
            this._arms.delete(oldest);
          }
        }
        return s;
      }
      /**
       * Compute total pulls across all levels for an arm.
       * @private
       */
      _totalPulls(arm) {
        const s = this._state(arm);
        return this.levels.reduce((t, l) => t + s.levels[l].pulls, 0);
      }
      /**
       * Compute current epsilon for exploration decay.
       * epsilon = max(exploreMin, explore / (1 + totalPulls/len(levels)))
       * @private
       */
      _epsilon(arm) {
        return Math.max(this.exploreMin, this.explore / (1 + this._totalPulls(arm) / this.levels.length));
      }
      /**
       * Select a level for the given arm using epsilon-greedy.
       * Explores with probability epsilon, exploits otherwise.
       * On exploit tie, picks lowest index (most conservative).
       * @param {string} arm
       * @returns {{ level: string, index: number, explored: boolean }}
       */
      select(arm) {
        const s = this._state(arm);
        this._touch(arm);
        if (this._random() < this._epsilon(arm)) {
          const idx = Math.min(this.levels.length - 1, Math.floor(this._random() * this.levels.length));
          return { level: this.levels[idx], index: idx, explored: true };
        }
        let best = 0;
        for (let i = 1; i < this.levels.length; i++) {
          if (s.levels[this.levels[i]].meanReward > s.levels[this.levels[best]].meanReward) {
            best = i;
          }
        }
        return { level: this.levels[best], index: best, explored: false };
      }
      /**
       * Update a level's reward via EMA and persist if backend available.
       * @param {string} arm
       * @param {string} level
       * @param {number} reward
       */
      update(arm, level, reward) {
        const s = this._state(arm);
        const st = s.levels[level];
        if (!st) return;
        st.pulls += 1;
        st.meanReward = st.meanReward + this.alpha * (reward - st.meanReward);
        if (this.backend) {
          this.backend.set(`governor-arm:${arm}`, s);
        }
      }
      /**
       * Load arm state from backend (if available).
       * @param {string} arm
       * @returns {Promise<void>}
       */
      async load(arm) {
        if (!this.backend) return;
        const v = await this.backend.get(`governor-arm:${arm}`);
        if (v && v.levels) {
          this._arms.set(arm, v);
        }
      }
      /**
       * Get stats for all levels of an arm.
       * @param {string} arm
       * @returns {Array<{ level: string, pulls: number, meanReward: number }>}
       */
      armStats(arm) {
        const s = this._state(arm);
        return this.levels.map((l) => ({
          level: l,
          pulls: s.levels[l].pulls,
          meanReward: s.levels[l].meanReward
        }));
      }
    };
    module2.exports = { computeReward, BanditController };
  }
});

// ../nodejs_optimizer/src/strategies/governor.js
var require_governor = __commonJS({
  "../nodejs_optimizer/src/strategies/governor.js"(exports2, module2) {
    "use strict";
    var { SignalCollector } = require_signalCollector();
    var { computeReward, BanditController } = require_bandit();
    var { detectContentType } = require_contentDetect();
    var DEFAULT_LEVELS = ["conservative", "balanced", "aggressive"];
    var DEFAULT_BUNDLES = {
      conservative: { abbreviation: { enabled: false }, whitespace: { aggressive: false }, stopwords: { enabled: false }, contentRouter: { aggressive: false } },
      balanced: { abbreviation: { enabled: true, aggressive: false }, whitespace: { aggressive: false }, contentRouter: { aggressive: false } },
      aggressive: { abbreviation: { enabled: true, aggressive: true }, whitespace: { aggressive: true }, contentRouter: { aggressive: true } }
    };
    var DEFAULT_WEIGHTS = { tokensSaved: 1, revert: 0.5, lostRetrieval: 20, cacheMissAnomaly: 5, retry: 50, shadowLoss: 100 };
    var QUALITY_SIGNALS = ["lostRetrievalRate", "retryRate", "shadowLossRate"];
    var CompressionGovernor = class {
      /**
       * @param {Object} config
       * @param {Object} deps - { backend, now, judge }
       */
      constructor(config = {}, deps = {}) {
        const DEFAULT_SHADOW_EVAL = { enabled: false, sampleRate: 0.05 };
        this.config = {
          enabled: false,
          explore: 0.1,
          exploreMin: 0.02,
          levels: DEFAULT_LEVELS,
          bundles: DEFAULT_BUNDLES,
          rollbackThreshold: 0.05,
          cooldownRuns: 50,
          maxConversations: 500,
          ...config,
          // Deep-merge one level: a partial `weights`/`shadowEval` override must not drop
          // the other default keys (a shallow merge here would silently produce missing
          // weight keys -> NaN reward, not caught by fail-open).
          weights: { ...DEFAULT_WEIGHTS, ...config.weights || {} },
          shadowEval: { ...DEFAULT_SHADOW_EVAL, ...config.shadowEval || {} }
        };
        this.judge = deps.judge || null;
        this.now = deps.now || (() => Date.now());
        this.collector = new SignalCollector({ alpha: 0.3 });
        this.bandit = new BanditController({
          levels: this.config.levels,
          explore: this.config.explore,
          exploreMin: this.config.exploreMin,
          random: deps.random,
          backend: deps.backend,
          maxConversations: this.config.maxConversations
        });
        this._cooldown = /* @__PURE__ */ new Map();
        this._errors = 0;
        this._loadedArms = /* @__PURE__ */ new Set();
      }
      _arm(ns, ct) {
        return `${ns || "default"}:${ct || "prose"}`;
      }
      /**
       * Hydrate this arm's bandit state from the backend, once per arm per process.
       * Must be called (and awaited) before selectConfig() for a fresh process to
       * see previously-persisted stats (e.g. each stateless plugin hook). Fail-open:
       * a backend read error must never break optimize().
       * @param {string} namespace
       * @param {string} contentType
       * @returns {Promise<void>}
       */
      async ensureLoaded(namespace, contentType) {
        if (!this.config.enabled) return;
        const arm = this._arm(namespace, contentType);
        if (this._loadedArms.has(arm)) return;
        try {
          await this.bandit.load(arm);
          this._loadedArms.add(arm);
        } catch (e) {
          this._errors++;
        }
      }
      /**
       * Select a config-override bundle for the given namespace/contentType arm.
       * @returns {{ level: string|null, overrides: Object, explored: boolean }}
       */
      selectConfig(namespace, contentType) {
        if (!this.config.enabled) return { level: null, overrides: {}, explored: false };
        try {
          const arm = this._arm(namespace, contentType);
          const cd = this._cooldown.get(arm);
          if (cd && cd.runsLeft > 0) return { level: cd.level, overrides: this.config.bundles[cd.level] || {}, explored: false };
          const sel = this.bandit.select(arm);
          return { level: sel.level, overrides: this.config.bundles[sel.level] || {}, explored: sel.explored };
        } catch (e) {
          this._errors++;
          return { level: null, overrides: {}, explored: false };
        }
      }
      /**
       * Ingest post-hoc signals for a completed request, update the bandit, and
       * run the guardrail rollback.
       * @returns {{ level: string|null, reward: number, rolledBack: boolean, floorBreach: boolean }}
       */
      observe(namespace, request, result, external = {}) {
        if (!this.config.enabled) return { level: null, reward: 0, rolledBack: false, floorBreach: false };
        try {
          const ct = external.contentType || this._detectCt(request);
          const arm = this._arm(namespace, ct);
          const level = external.level || result && result._governorLevel || this._currentLevel(arm);
          const rates = this.collector.ingest(arm, { stats: result && result.stats || {}, external });
          const reward = computeReward(rates, this.config.weights);
          if (level) this.bandit.update(arm, level, reward);
          let rolledBack = false;
          let floorBreach = false;
          const breached = QUALITY_SIGNALS.some((k) => rates[k] > this.config.rollbackThreshold);
          if (breached) {
            const idx = this.config.levels.indexOf(level);
            if (idx > 0) {
              const downLevel = this.config.levels[idx - 1];
              const prev = this._cooldown.get(arm);
              const breaches = (prev ? prev.breaches : 0) + 1;
              this._cooldown.set(arm, { level: downLevel, runsLeft: this.config.cooldownRuns * Math.pow(2, breaches - 1), breaches });
              if (this._cooldown.size > this.config.maxConversations) {
                const oldest = this._cooldown.keys().next().value;
                this._cooldown.delete(oldest);
              }
              rolledBack = true;
            } else if (idx === 0) {
              floorBreach = true;
            }
          }
          const cd = this._cooldown.get(arm);
          if (cd && cd.runsLeft > 0 && !rolledBack) {
            cd.runsLeft--;
            if (cd.runsLeft <= 0) this._cooldown.delete(arm);
          }
          return { level, reward, rolledBack, floorBreach };
        } catch (e) {
          this._errors++;
          return { level: null, reward: 0, rolledBack: false, floorBreach: false };
        }
      }
      _detectCt(request) {
        const msgs = request && request.messages || [];
        const last = [...msgs].reverse().find((m) => m.role !== "system" && typeof m.content === "string");
        return last ? detectContentType(last.content) : "prose";
      }
      _currentLevel(arm) {
        const cd = this._cooldown.get(arm);
        if (cd && cd.runsLeft > 0) return cd.level;
        const stats = this.bandit.armStats(arm);
        let best = stats[0];
        for (const s of stats) if (s.meanReward > best.meanReward) best = s;
        return best.level;
      }
      snapshot() {
        const arms = {};
        for (const arm of this._armKeys()) arms[arm] = this.bandit.armStats(arm);
        return { arms };
      }
      _armKeys() {
        return [...this.bandit._arms.keys()];
      }
      stats(namespace, contentType) {
        const arm = this._arm(namespace, contentType);
        return { name: "governor", arm, governorErrors: this._errors, cooldown: this._cooldown.get(arm) || null };
      }
    };
    module2.exports = { CompressionGovernor, DEFAULT_BUNDLES, DEFAULT_LEVELS };
  }
});

// ../nodejs_optimizer/src/index.js
var require_src = __commonJS({
  "../nodejs_optimizer/src/index.js"(exports2, module2) {
    "use strict";
    var { Pipeline, DEFAULT_CONFIG } = require_pipeline();
    var { Metrics } = require_metrics();
    var { ExactCache } = require_exactCache();
    var { SemanticCache } = require_semanticCache();
    var { countTokens, countMessages, setTokenizer, resetTokenizer } = require_tokenCounter();
    var { detectContentType } = require_contentDetect();
    var { compressContent } = require_contentRouter();
    var whitespace = require_whitespace();
    var abbreviation = require_abbreviation();
    var stopwords = require_stopwords();
    var jsonMinifier = require_jsonMinifier();
    var logCompressor = require_logCompressor();
    var codeCompressor = require_codeCompressor();
    var dedup = require_dedup();
    var historyCompactor = require_historyCompactor();
    var truncation = require_truncation();
    var entropyMask = require_entropyMask();
    var astCompressor = require_astCompressor();
    var pyAstCompressor = require_pyAstCompressor();
    var maskUnion = require_maskUnion();
    var contentRouter = require_contentRouter();
    var { CCRStore } = require_ccr();
    var { CacheAligner } = require_cacheAligner();
    var { CacheEconomicsScheduler } = require_cacheEconomics();
    var { DictionaryCodec } = require_dictionaryCodec();
    var { CompressionGovernor } = require_governor();
    var { stableHash } = require_hash();
    var DEFAULT_OPTIMIZER_CONFIG = {
      exactCache: { enabled: true, maxEntries: 1e3, ttlMs: 60 * 60 * 1e3 },
      semanticCache: { enabled: false, threshold: 0.92, maxEntries: 500, ttlMs: 60 * 60 * 1e3 },
      pipeline: {},
      // forwarded to Pipeline (uses DEFAULT_CONFIG)
      metrics: { enabled: true },
      cacheEconomics: { enabled: false },
      dictionary: { enabled: false },
      governor: { enabled: false }
    };
    var MAX_PENDING_GOVERNOR_CONTEXTS = 1e3;
    var TokenOptimizer = class {
      /**
       * @param {object} [config]
       * @param {object} [deps] - { summarizer, embed, tokenizer, cacheBackend, exactCache, semanticCache }
       */
      constructor(config = {}, deps = {}) {
        const userCacheEconomics = config && config.cacheEconomics || {};
        this.config = mergeConfig(DEFAULT_OPTIMIZER_CONFIG, config);
        if (deps.tokenizer) setTokenizer(deps.tokenizer);
        if (deps.contentDetector) contentRouter.setDetector(deps.contentDetector);
        this.exactCache = deps.exactCache || (this.config.exactCache.enabled ? new ExactCache({
          backend: deps.cacheBackend,
          maxEntries: this.config.exactCache.maxEntries,
          ttlMs: this.config.exactCache.ttlMs,
          namespace: this.config.exactCache.namespace
        }) : null);
        this.semanticCache = deps.semanticCache || (this.config.semanticCache.enabled ? new SemanticCache({
          threshold: this.config.semanticCache.threshold,
          maxEntries: this.config.semanticCache.maxEntries,
          ttlMs: this.config.semanticCache.ttlMs,
          embed: deps.embed,
          namespace: this.config.semanticCache.namespace,
          verify: this.config.semanticCache.verify,
          verifiedThreshold: this.config.semanticCache.verifiedThreshold
        }) : null);
        this.config.pipeline = {
          ...this.config.pipeline,
          cacheEconomics: { ...this.config.pipeline.cacheEconomics || {}, ...userCacheEconomics },
          dictionary: { ...this.config.pipeline.dictionary || {}, ...config.dictionary || {} }
        };
        this.scheduler = new CacheEconomicsScheduler(
          { ...this.config.pipeline.cacheEconomics, ...userCacheEconomics },
          { backend: deps.cacheBackend }
        );
        this.dictionaryCodec = new DictionaryCodec(this.config.pipeline.dictionary, {
          ccr: this.ccr || null,
          // Prefer a dedicated dictionary backend if the caller supplies one, so
          // dictionary state can be persisted to its own store without colliding
          // with (or being evicted by) exact-cache entries. Falls back to the
          // shared cacheBackend to preserve prior behavior for existing callers.
          backend: deps.dictionaryBackend || deps.cacheBackend
        });
        this.pipelineDeps = {
          summarizer: deps.summarizer,
          tokenCounter: deps.tokenizer || countTokens,
          scheduler: this.scheduler,
          dictionaryCodec: this.dictionaryCodec
        };
        this.pipeline = new Pipeline(this.config.pipeline, this.pipelineDeps);
        this.metrics = this.config.metrics.enabled ? new Metrics() : null;
        this.governor = new CompressionGovernor(this.config.governor, {
          // Prefer a dedicated governor backend (so bandit arms persist to their
          // own store and are never evicted by exact-cache churn). Falls back to
          // the shared cacheBackend to preserve prior behavior for existing callers.
          backend: deps.governorBackend || deps.cacheBackend,
          judge: deps.judge,
          now: deps.now,
          random: deps.random
        });
        this._pendingGovernor = /* @__PURE__ */ new Map();
      }
      /**
       * Optimize a request.
       *
       * @param {object} request - Chat-completion-shape request
       * @returns {Promise<{request: object, stats: object, cacheHit: boolean, cachedResponse?: any, cacheType?: string, similarity?: number}>}
       */
      async optimize(request) {
        const t0 = Date.now();
        const result = {
          request,
          stats: { beforeTokens: 0, afterTokens: 0, savedTokens: 0, savedPercent: 0, steps: [] },
          cacheHit: false
        };
        try {
          if (this.exactCache) {
            const cached = await this.exactCache.get(request);
            if (cached !== void 0) {
              result.cacheHit = true;
              result.cacheType = "exact";
              result.cachedResponse = cached;
              result.stats.beforeTokens = countMessages(request.messages, request.model);
              result.stats.afterTokens = 0;
              result.stats.savedTokens = result.stats.beforeTokens;
              result.stats.savedPercent = 100;
              this._record(request, result, t0, true);
              return result;
            }
          }
          if (this.semanticCache) {
            const cached = await this.semanticCache.get(request);
            if (cached !== void 0) {
              result.cacheHit = true;
              result.cacheType = "semantic";
              result.cachedResponse = cached.response;
              result.similarity = cached.similarity;
              result.stats.beforeTokens = countMessages(request.messages, request.model);
              result.stats.afterTokens = 0;
              result.stats.savedTokens = result.stats.beforeTokens;
              result.stats.savedPercent = 100;
              this._record(request, result, t0, true);
              return result;
            }
          }
          let pipeline = this.pipeline;
          let governorCtx = null;
          if (this.config.governor.enabled) {
            const ct = detectContentType(this._lastUserContent(request));
            const ns = request.user || request.metadata && request.metadata.namespace || "default";
            await this.governor.ensureLoaded(ns, ct);
            const sel = this.governor.selectConfig(ns, ct);
            if (sel.level && sel.overrides && Object.keys(sel.overrides).length > 0) {
              const runConfig = mergeConfig(this.config.pipeline, sel.overrides);
              pipeline = new Pipeline(runConfig, this.pipelineDeps);
            }
            governorCtx = { ns, ct, level: sel.level, explored: sel.explored };
          }
          const out = await pipeline.run(request);
          result.request = out.request;
          result.stats = out.stats;
          if (governorCtx) {
            result._governorLevel = governorCtx.level;
            result.stats.steps.push({
              name: "governor",
              level: governorCtx.level,
              explored: governorCtx.explored,
              namespace: governorCtx.ns,
              contentType: governorCtx.ct
            });
            this._stashGovernorContext(request, { ns: governorCtx.ns, ct: governorCtx.ct, level: governorCtx.level, stats: result.stats });
          }
          this._record(request, result, t0, false);
          return result;
        } catch (err) {
          result.error = err.message || String(err);
          if (this.metrics) this.metrics.record({ error: true, model: request.model });
          return result;
        }
      }
      /**
       * Store a response in cache(s). Call this after receiving a real response
       * from the provider.
       *
       * If the governor is enabled, also feeds it the post-hoc signals for the
       * request that was optimized (retry, contentType, shadowLoss, etc.) so it
       * can update the bandit and enforce the rollback guardrail. The level that
       * actually ran is read from opts.governorLevel if provided, else from the
       * context stashed by optimize() (keyed by a stable hash of the request) —
       * this guarantees observe() never falls back to the governor's internal
       * "current best" guess, which would misattribute breaches at cold start.
       */
      async recordResponse(request, response, opts = {}) {
        if (this.exactCache) await this.exactCache.set(request, response, opts.ttlMs);
        if (this.semanticCache) await this.semanticCache.set(request, response, opts.ttlMs);
        if (this.scheduler && response && response.usage) {
          await this.scheduler.observe(request, response.usage);
        }
        if (this.config.governor.enabled) {
          const ctx = this._takeGovernorContext(request);
          const level = opts.governorLevel || ctx && ctx.level || null;
          if (!level) return;
          const ns = opts.namespace || ctx && ctx.ns || request.user || request.metadata && request.metadata.namespace || "default";
          const ct = opts.contentType || ctx && ctx.ct;
          const stats = ctx && ctx.stats || { steps: [] };
          this.governor.observe(ns, request, { stats, _governorLevel: level }, {
            level,
            retry: opts.retry,
            contentType: ct,
            lostRetrievalDelta: opts.lostRetrievalDelta,
            shadowLoss: opts.shadowLoss
          });
        }
      }
      /** @private */
      _lastUserContent(request) {
        const msgs = request && request.messages || [];
        const last = [...msgs].reverse().find((m) => m.role !== "system" && typeof m.content === "string");
        return last ? last.content : "";
      }
      /** @private */
      _requestKey(request) {
        try {
          return stableHash(request);
        } catch (e) {
          return null;
        }
      }
      /** @private */
      _stashGovernorContext(request, ctx) {
        const key = this._requestKey(request);
        if (!key) return;
        if (this._pendingGovernor.size >= MAX_PENDING_GOVERNOR_CONTEXTS) {
          const oldest = this._pendingGovernor.keys().next().value;
          this._pendingGovernor.delete(oldest);
        }
        this._pendingGovernor.set(key, ctx);
      }
      /** @private */
      _takeGovernorContext(request) {
        const key = this._requestKey(request);
        if (!key) return null;
        const ctx = this._pendingGovernor.get(key);
        if (ctx) this._pendingGovernor.delete(key);
        return ctx || null;
      }
      /**
       * Wrap a provider-call function to automatically benefit from caching and
       * optimization. The wrapped function:
       *   - applies the pipeline
       *   - returns cached response if hit
       *   - else calls the provider with the optimized request, then caches the response
       *
       * @example
       *   const callLLM = opt.wrap(async (req) => openai.chat.completions.create(req));
       *   const response = await callLLM({ messages, model: 'gpt-4o' });
       */
      wrap(providerCall, opts = {}) {
        return async (request) => {
          const r = await this.optimize(request);
          if (r.cacheHit) {
            return r.cachedResponse;
          }
          const response = await providerCall(r.request);
          let shadowLoss;
          const se = this.config.governor.enabled && this.governor.config.shadowEval;
          if (se && se.enabled && this.governor.judge && Math.random() < (se.sampleRate || 0)) {
            try {
              const uncompressedResponse = await providerCall(request);
              shadowLoss = await this.governor.judge(response, uncompressedResponse);
            } catch (e) {
            }
          }
          if (opts.cacheResponse !== false) {
            await this.recordResponse(request, response, shadowLoss !== void 0 ? { ...opts, shadowLoss } : opts);
          }
          return response;
        };
      }
      getMetrics() {
        if (!this.metrics) return null;
        return {
          ...this.metrics.snapshot(),
          exactCache: this.exactCache ? this.exactCache.getStats() : null,
          semanticCache: this.semanticCache ? this.semanticCache.getStats() : null,
          governor: this.governor ? this.governor.snapshot() : null
        };
      }
      async clearCache() {
        if (this.exactCache) await this.exactCache.clear();
        if (this.semanticCache) await this.semanticCache.clear();
      }
      resetMetrics() {
        if (this.metrics) this.metrics.reset();
      }
      _record(request, result, startMs, cacheChecked) {
        if (!this.metrics) return;
        this.metrics.record({
          model: request.model,
          cacheHit: result.cacheHit,
          cacheChecked,
          cacheType: result.cacheType,
          stats: result.stats,
          latencyMs: Date.now() - startMs,
          error: !!result.error
        });
      }
    };
    function mergeConfig(base, override) {
      const out = { ...base };
      for (const k of Object.keys(override)) {
        if (override[k] && typeof override[k] === "object" && !Array.isArray(override[k]) && base[k]) {
          out[k] = { ...base[k], ...override[k] };
        } else {
          out[k] = override[k];
        }
      }
      return out;
    }
    module2.exports = {
      TokenOptimizer,
      Pipeline,
      Metrics,
      ExactCache,
      SemanticCache,
      CCRStore,
      CacheAligner,
      CacheEconomicsScheduler,
      DictionaryCodec,
      CompressionGovernor,
      // Utils
      countTokens,
      countMessages,
      setTokenizer,
      resetTokenizer,
      detectContentType,
      compressContent,
      // Individual optimizers
      optimizers: {
        whitespace,
        abbreviation,
        stopwords,
        jsonMinifier,
        logCompressor,
        codeCompressor,
        astCompressor,
        pyAstCompressor,
        dedup,
        historyCompactor,
        truncation,
        entropyMask
      },
      strategies: {
        maskUnion,
        contentRouter
      },
      // Defaults for inspection
      DEFAULT_CONFIG,
      DEFAULT_OPTIMIZER_CONFIG
    };
  }
});

// lib/optimizer-instance.js
var require_optimizer_instance = __commonJS({
  "lib/optimizer-instance.js"(exports2, module2) {
    "use strict";
    var fs = require("node:fs");
    var path = require("node:path");
    var os = require("node:os");
    var TokenOptimizer;
    var optimizers;
    var strategies;
    var CCRStore;
    var countTokens;
    var detectContentType;
    try {
      const lib = require_src();
      ({ TokenOptimizer, optimizers, strategies, CCRStore, countTokens, detectContentType } = lib);
    } catch (e) {
      const fallback = path.resolve(__dirname, "..", "..", "nodejs_optimizer", "src", "index.js");
      const lib = require(fallback);
      ({ TokenOptimizer, optimizers, strategies, CCRStore, countTokens, detectContentType } = lib);
    }
    var DATA_DIR = process.env.TOKEN_OPTIMIZER_DATA_DIR || path.join(os.homedir(), ".claude", "plugins", "agentone-token-compression", "data");
    function ensureDir() {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch {
      }
    }
    function safeReadJson(file, fallback) {
      try {
        if (!fs.existsSync(file)) return fallback;
        const raw = fs.readFileSync(file, "utf8");
        if (!raw.trim()) return fallback;
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    }
    function atomicWriteJson(file, data) {
      try {
        ensureDir();
        const tmp = file + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(data));
        fs.renameSync(tmp, file);
      } catch (e) {
      }
    }
    var JsonFileBackend = class {
      constructor(file, maxEntries = 2e3) {
        this.file = file;
        this.maxEntries = maxEntries;
        this.cache = safeReadJson(file, { entries: {}, order: [], expiries: {} });
        if (!this.cache.entries) this.cache.entries = {};
        if (!Array.isArray(this.cache.order)) this.cache.order = [];
        if (!this.cache.expiries) this.cache.expiries = {};
      }
      async get(key) {
        const exp = this.cache.expiries[key];
        if (exp && exp < Date.now()) {
          delete this.cache.entries[key];
          delete this.cache.expiries[key];
          this.cache.order = this.cache.order.filter((k) => k !== key);
          return void 0;
        }
        if (key in this.cache.entries) {
          this.cache.order = this.cache.order.filter((k) => k !== key);
          this.cache.order.push(key);
          return this.cache.entries[key];
        }
        return void 0;
      }
      async set(key, value, ttlMs) {
        if (!(key in this.cache.entries) && this.cache.order.length >= this.maxEntries) {
          const oldest = this.cache.order.shift();
          if (oldest) {
            delete this.cache.entries[oldest];
            delete this.cache.expiries[oldest];
          }
        }
        this.cache.entries[key] = value;
        this.cache.order = this.cache.order.filter((k) => k !== key);
        this.cache.order.push(key);
        if (ttlMs && ttlMs > 0) this.cache.expiries[key] = Date.now() + ttlMs;
        atomicWriteJson(this.file, this.cache);
      }
      async delete(key) {
        delete this.cache.entries[key];
        delete this.cache.expiries[key];
        this.cache.order = this.cache.order.filter((k) => k !== key);
        atomicWriteJson(this.file, this.cache);
      }
      async size() {
        return Object.keys(this.cache.entries).length;
      }
      async clear() {
        this.cache = { entries: {}, order: [], expiries: {} };
        atomicWriteJson(this.file, this.cache);
      }
    };
    var _instance = null;
    function getOptimizer(overrides = {}) {
      if (_instance) return _instance;
      ensureDir();
      const userConfigPath = path.join(DATA_DIR, "config.json");
      const userConfig = safeReadJson(userConfigPath, {});
      const config = {
        exactCache: {
          enabled: true,
          maxEntries: 2e3,
          ttlMs: 7 * 24 * 60 * 60 * 1e3,
          // 7 days
          ...userConfig.exactCache
        },
        semanticCache: {
          enabled: true,
          threshold: 0.92,
          maxEntries: 1e3,
          ttlMs: 7 * 24 * 60 * 60 * 1e3,
          ...userConfig.semanticCache
        },
        pipeline: {
          dedupe: { enabled: true, threshold: 0.92 },
          history: { enabled: false },
          // Don't touch Claude's history — Claude manages it
          cacheAligner: { enabled: false },
          entropyProtection: {
            enabled: true,
            threshold: 0.85,
            detectors: ["entropy", "secrets", "urls", "numbers"]
          },
          contentRouter: { enabled: true, aggressive: false, codeMode: "comments" },
          abbreviation: { enabled: false },
          // Off for prompts — preserves user intent
          stopwords: { enabled: false },
          whitespace: { enabled: true, aggressive: false },
          truncation: { enabled: false },
          ...userConfig.pipeline
        },
        metrics: { enabled: true },
        // ── REVERSIBLE AST body-drop for code reads (hook reads this flag) ────
        // When true, the PostToolUse hook drops JS/TS function/method/arrow bodies
        // on large code Reads (signatures + TS types + doc comments preserved),
        // storing each dropped body on disk via lib/body-store.js keyed by a short
        // id and embedding an `AGENTONE-ELIDED:<id>` marker. The plugin's MCP
        // `retrieve` tool returns the exact body on demand, so this is LOSSLESS via
        // retrieval (unlike a plain irreversible AST drop). Credentials/URLs in a
        // body are never elided (PROTECTED_RE guard). The retrieval-MISS rate is the
        // real quality signal for how aggressive the drop can safely be — the plugin
        // does NOT fabricate that signal; it only records what it can observe.
        codeReversible: true,
        // ── Spec 3: prefix-resident dictionary codec ──────────────────────────
        // Emits an inline model-decodable glossary so a single replaced output
        // stays self-decoding (LOSSLESS): every code that appears in the replaced
        // text is defined in a `[dictionary]` block prepended to the same message.
        // `reversible:'auto'` uses a CCR backend when one is present, else stays
        // self-contained (no external retrieval needed) — which is exactly the
        // standalone Claude Code hook case.
        //
        // NOTE/LIMITATION: the library DictionaryCodec keeps its miner/codebook in
        // in-memory Maps and does NOT consume a plugin-supplied backend (its
        // `deps.backend` is documented "reserved for future backend integration").
        // Each stateless hook process therefore starts with an empty codebook and
        // mines within the single output it sees; codes are self-contained per
        // output via the inline glossary. We still construct a JsonFileBackend so
        // that if/when the codec gains backend persistence it is wired, and it is
        // harmless today. See report + TECHNIQUES.
        dictionary: {
          enabled: true,
          reversible: "auto",
          ...userConfig.dictionary
        },
        // ── Spec 4: closed-loop compression governor (bandit) ─────────────────
        // Arms keyed by (namespace, contentType). Persisted to disk via a
        // JsonFileBackend so arm reward estimates survive across the stateless
        // hook processes (index.js awaits governor.ensureLoaded before select).
        //
        // SAFETY CAP (critical — real replacement is now irreversible and there is
        // NO standalone retrieval path in Claude Code hook mode): the governor's
        // level bundles are overridden below so that NO level engages an
        // irreversible lossy-without-retrieval transform. Specifically:
        //   - no bundle sets contentRouter.codeMode='ast' (AST function-body drop),
        //   - the "aggressive" bundle does NOT strip code docstrings; it is capped
        //     at bounded/safe transforms (whitespace, json minify/tabular, bounded
        //     log head+tail collapse, prose abbreviation, dictionary+inline
        //     glossary). All of these either preserve information or are
        //     model-decodable in-place.
        // Reward is driven only by the signals the plugin can actually produce
        // (token savings + tokenGuard revert). Signals a hook cannot observe
        // (shadow-eval / retrieval-miss / retry) are left at their neutral
        // defaults so the loop degrades gracefully rather than being faked.
        governor: {
          enabled: true,
          bundles: {
            conservative: {
              abbreviation: { enabled: false },
              whitespace: { aggressive: false },
              stopwords: { enabled: false },
              contentRouter: { enabled: true, aggressive: false, codeMode: "comments" }
            },
            balanced: {
              abbreviation: { enabled: true, aggressive: false },
              whitespace: { aggressive: false },
              contentRouter: { enabled: true, aggressive: false, codeMode: "comments" }
            },
            // Capped: aggressive whitespace + json/log aggression + prose
            // abbreviation, but codeMode stays 'comments' here — the governor never
            // engages an IRREVERSIBLE AST body-drop. Aggressive compression of code
            // reads instead goes through the hook's REVERSIBLE AST path (config
            // `codeReversible`, lib/body-store.js + MCP `retrieve`): bodies are
            // dropped but recoverable, and the retrieval-MISS rate is the quality
            // signal that says whether the drop was too aggressive. We do not fake
            // that retrieval signal — only observed misses count.
            aggressive: {
              abbreviation: { enabled: true, aggressive: true },
              whitespace: { aggressive: true },
              contentRouter: { enabled: true, aggressive: true, codeMode: "comments" }
            }
          },
          ...userConfig.governor
        },
        // ── Spec 2: cache-economics scheduler ─────────────────────────────────
        // Left OFF. Spec 2's marker-placement + TTL economics require control of
        // the real provider request AND provider cache-usage telemetry
        // (response.usage.cache_*). A PostToolUse hook builds a synthetic
        // single-message request and never sees provider telemetry, so the
        // scheduler would have no signal to act on. Enabling it would be inert at
        // best; we leave it off rather than imply a capability the hook cannot
        // deliver. Requires a gateway. See report + TECHNIQUES.
        cacheEconomics: { enabled: false, ...userConfig.cacheEconomics },
        ...overrides
      };
      const exactBackend = new JsonFileBackend(path.join(DATA_DIR, "cache-exact.json"), config.exactCache.maxEntries);
      const governorBackend = new JsonFileBackend(path.join(DATA_DIR, "governor-arms.json"), 500);
      const dictionaryBackend = new JsonFileBackend(path.join(DATA_DIR, "dictionary-codebook.json"), 500);
      _instance = {
        optimizer: new TokenOptimizer(config, {
          cacheBackend: exactBackend,
          // index.js honors dedicated `governorBackend`/`dictionaryBackend` deps
          // (falling back to cacheBackend when absent). We give each its own file
          // so bandit arms are persisted independently and never evicted by
          // exact-cache churn. If an OLDER installed library ignores these extra
          // deps, the governor/dictionary transparently fall back to the shared
          // cacheBackend, which still persists arms (namespaced by the
          // `governor-arm:` key prefix) — the persistence test passes either way.
          governorBackend,
          dictionaryBackend
        }),
        optimizers,
        strategies,
        CCRStore,
        countTokens,
        detectContentType,
        config,
        dataDir: DATA_DIR
      };
      return _instance;
    }
    function loadStats2() {
      return safeReadJson(path.join(DATA_DIR, "stats.json"), {
        createdAt: Date.now(),
        totalRequests: 0,
        totalCacheHits: 0,
        totalTokensSeen: 0,
        totalTokensSaved: 0,
        byHook: {},
        bySession: {},
        lastUpdated: Date.now()
      });
    }
    function saveStats(stats) {
      stats.lastUpdated = Date.now();
      atomicWriteJson(path.join(DATA_DIR, "stats.json"), stats);
    }
    function recordSavings({ hook, sessionId, beforeTokens, afterTokens, cacheHit }) {
      ensureDir();
      const stats = loadStats2();
      stats.totalRequests++;
      if (cacheHit) stats.totalCacheHits++;
      stats.totalTokensSeen += Math.max(0, beforeTokens || 0);
      stats.totalTokensSaved += Math.max(0, (beforeTokens || 0) - (afterTokens || 0));
      if (hook) {
        stats.byHook[hook] = stats.byHook[hook] || { requests: 0, hits: 0, saved: 0 };
        stats.byHook[hook].requests++;
        if (cacheHit) stats.byHook[hook].hits++;
        stats.byHook[hook].saved += Math.max(0, (beforeTokens || 0) - (afterTokens || 0));
      }
      if (sessionId) {
        stats.bySession[sessionId] = stats.bySession[sessionId] || { requests: 0, saved: 0, started: Date.now() };
        stats.bySession[sessionId].requests++;
        stats.bySession[sessionId].saved += Math.max(0, (beforeTokens || 0) - (afterTokens || 0));
      }
      saveStats(stats);
      return stats;
    }
    function maybeBuildOptimizeSuggestion() {
      try {
        const stats = loadStats2();
        const config = safeReadJson(path.join(DATA_DIR, "config.json"), {});
        if (config.dismissSuggestions === true) return null;
        const requests = stats.totalRequests || 0;
        const tokensSeen = stats.totalTokensSeen || 0;
        const tokensSaved = stats.totalTokensSaved || 0;
        const reductionPct = tokensSeen > 0 ? tokensSaved / tokensSeen : 0;
        const hitRate = requests > 0 ? (stats.totalCacheHits || 0) / requests : 0;
        const enoughData = requests >= 30;
        const lowReduction = reductionPct < 0.35;
        const lowHitRate = hitRate < 0.15;
        const shouldSuggest = enoughData && (lowReduction || lowHitRate);
        if (!shouldSuggest) return null;
        const lastAt = stats._lastOptimizeSuggestionAt || 0;
        if (Date.now() - lastAt < 24 * 60 * 60 * 1e3) return null;
        const codeMode = config?.pipeline?.contentRouter?.codeMode;
        const threshold = config?.semanticCache?.threshold;
        if (codeMode === "ast" && (typeof threshold !== "number" || threshold <= 0.86)) {
          return null;
        }
        const reasons = [];
        if (lowReduction) reasons.push(`only ${(reductionPct * 100).toFixed(0)}% reduction`);
        if (lowHitRate) reasons.push(`${(hitRate * 100).toFixed(0)}% cache hit rate`);
        const msg = `[AgentOne TokenOptimizer by Iterate.ai] After ${requests} requests you've got ${reasons.join(" and ")}. Run /optimize to unlock +30-50% on code (AST mode), +15-25% via looser semantic cache, and other tweaks. Trade-off: AST mode drops function bodies (signatures preserved, lossless via tool retrieval). Run /optimize_dashboard to see your current numbers first, or /tokens-config dismissSuggestions=true to silence this.`;
        stats._lastOptimizeSuggestionAt = Date.now();
        stats._optimizeSuggestionsShown = (stats._optimizeSuggestionsShown || 0) + 1;
        saveStats(stats);
        return msg;
      } catch {
        return null;
      }
    }
    function readStdin2() {
      return new Promise((resolve) => {
        if (process.stdin.isTTY) return resolve("");
        let buf = "";
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          process.stdin.removeAllListeners("readable");
          process.stdin.removeAllListeners("end");
          process.stdin.removeAllListeners("close");
          process.stdin.removeAllListeners("error");
          resolve(buf);
        };
        process.stdin.setEncoding("utf8");
        process.stdin.on("readable", () => {
          let chunk;
          while ((chunk = process.stdin.read()) !== null) buf += chunk;
        });
        process.stdin.on("end", finish);
        process.stdin.on("close", finish);
        process.stdin.on("error", finish);
        const timer = setTimeout(finish, 750);
        timer.unref && timer.unref();
      });
    }
    function isDisabled2() {
      return process.env.TOKEN_OPTIMIZER_DISABLED === "1" || process.env.TOKEN_OPTIMIZER_DISABLED === "true";
    }
    module2.exports = {
      getOptimizer,
      recordSavings,
      maybeBuildOptimizeSuggestion,
      loadStats: loadStats2,
      saveStats,
      readStdin: readStdin2,
      isDisabled: isDisabled2,
      DATA_DIR
    };
  }
});

// hooks/session-end.js
var { loadStats, readStdin, isDisabled } = require_optimizer_instance();
async function main() {
  if (isDisabled()) {
    return done({});
  }
  let payload;
  try {
    payload = JSON.parse(await readStdin() || "{}");
  } catch {
    return done({});
  }
  const sessionId = payload.session_id;
  const stats = loadStats();
  const session = (stats.bySession || {})[sessionId];
  if (!session || session.requests === 0) {
    return done({});
  }
  const durationMin = ((Date.now() - session.started) / 6e4).toFixed(1);
  const note = `[AgentOne TokenOptimizer by Iterate.ai] Session summary \u2014 ${session.requests} hook calls, ~${session.saved.toLocaleString()} tokens saved over ${durationMin} min.`;
  done({ systemMessage: note });
}
function done(out) {
  process.stdout.write(JSON.stringify(out));
}
main().catch(() => done({}));
