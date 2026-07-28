import crypto from "crypto";
import fs from "fs";
import path from "path";

export function normalizePath(p) {
  return p.split(path.sep).join("/").replace(/^\.\//, "");
}

export function stableObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = stableObject(value[key]);
    }
    return out;
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableObject(value), null, 2) + "\n";
}

export function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readTextSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export function isLikelyBinary(buffer) {
  const len = Math.min(buffer.length, 8192);
  let zeroCount = 0;
  for (let i = 0; i < len; i += 1) {
    if (buffer[i] === 0) zeroCount += 1;
  }
  return len > 0 && zeroCount / len > 0.01;
}

export function matchGlobLike(relPath, patterns) {
  const n = normalizePath(relPath);
  return patterns.some((pattern) => {
    const p = normalizePath(pattern).replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
    const re = new RegExp(`^${p}$`);
    return re.test(n);
  });
}

export function fileCategoryFromExtension(ext) {
  const e = ext.toLowerCase();
  const map = {
    ".ts": "source",
    ".tsx": "source",
    ".js": "source",
    ".mjs": "source",
    ".cjs": "source",
    ".json": "configuration",
    ".md": "documentation",
    ".yml": "configuration",
    ".yaml": "configuration",
    ".prisma": "persistence",
    ".sql": "persistence",
    ".html": "asset",
    ".css": "asset",
    ".sh": "script",
    ".ps1": "script",
    "": "unknown"
  };
  return map[e] || "unknown";
}

export function booleanFlagsForPath(relPath, category) {
  const p = normalizePath(relPath).toLowerCase();
  const fileName = path.basename(p);
  return {
    isHidden: p.split("/").some((part) => part.startsWith(".")),
    isGenerated: p.includes("generated/") || p.includes("out/") || p.includes("evidence-output/"),
    isSource: category === "source",
    isTest: /(^|\/)(test|tests|__tests__)(\/|$)|\.test\./.test(p),
    isDocumentation: category === "documentation" || p.startsWith("docs/"),
    isConfiguration: category === "configuration" || /(^|\/)(\.github|config)(\/|$)/.test(p),
    isEvidenceOutput: p.startsWith("genesis/audits/") || p.startsWith("evidence-output/") || p.includes("report"),
    isMigration: p.includes("prisma/migrations/") || fileName.includes("migration"),
    isScript: category === "script" || p.startsWith("scripts/") || p.startsWith("tools/"),
    isAsset: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".css", ".html"].some((x) => p.endsWith(x)),
    isGovernanceRelated: /(constitution|governance|certification|validation|compliance|freeze|readiness|architecture)/.test(p)
  };
}

export function topLevelSubsystem(relPath) {
  return normalizePath(relPath).split("/")[0] || "";
}

export function depthOf(relPath) {
  const n = normalizePath(relPath);
  return n.length === 0 ? 0 : n.split("/").length - 1;
}

export function idFactory(prefix) {
  let i = 0;
  return () => {
    i += 1;
    return `${prefix}-${String(i).padStart(6, "0")}`;
  };
}
