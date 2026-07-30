import fs from "fs";
import path from "path";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SCAN_ROOTS = ["src/platform/gop", "src/lib/gop", "src/app/glw/(protected)"];
const CANONICAL_WORKSPACE_IDENTITY_FILE = "src/platform/gop/workspaces/identity.ts";

function isWorkspaceNormalizationScope(relPath) {
  if (relPath.startsWith("src/platform/gop/")) {
    return true;
  }
  if (relPath.startsWith("src/lib/gop/")) {
    return true;
  }
  if (relPath === "src/app/glw/(protected)/layout.tsx") {
    return true;
  }
  return relPath.endsWith("/access.ts");
}

function normalizePath(input) {
  return input.split(path.sep).join("/");
}

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") {
      options.json = true;
      continue;
    }

    if (token === "--root") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --root.");
      }
      options.root = path.resolve(value);
      index += 1;
    }
  }

  return options;
}

function collectSourceFiles(rootDir) {
  const files = [];

  for (const scanRoot of SCAN_ROOTS) {
    const absRoot = path.join(rootDir, scanRoot);
    if (!fs.existsSync(absRoot)) {
      continue;
    }

    const stack = [absRoot];
    while (stack.length > 0) {
      const current = stack.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });

      for (const entry of entries) {
        const absPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(absPath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
          continue;
        }

        const relPath = normalizePath(path.relative(rootDir, absPath));
        files.push({ relPath, absPath });
      }
    }
  }

  return files.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function toLine(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function extractImports(text) {
  const imports = [];
  const patterns = [
    /import\s+[\s\S]*?from\s+["']([^"']+)["']/g,
    /export\s+[\s\S]*?from\s+["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      imports.push({
        specifier: match[1],
        line: toLine(text, match.index),
      });
      match = pattern.exec(text);
    }
  }

  return imports;
}

function collectPatternHits(text, pattern) {
  const hits = [];
  const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match = regex.exec(text);
  while (match) {
    hits.push({
      text: match[0],
      line: toLine(text, match.index),
    });
    match = regex.exec(text);
  }
  return hits;
}

function evaluateRules(rootDir) {
  const files = collectSourceFiles(rootDir);
  const violations = [];
  const metrics = {
    platformToGlwImports: 0,
    authnPolicyTokens: 0,
    authzAuthnTokens: 0,
    bootstrapAppLeak: 0,
    workspaceLiteralCount: 0,
    scannedFiles: files.length,
  };

  for (const file of files) {
    const text = fs.readFileSync(file.absPath, "utf8");
    const imports = extractImports(text);
    const isPlatformFile = file.relPath.startsWith("src/platform/gop/");

    if (isPlatformFile) {
      for (const entry of imports) {
        if (
          entry.specifier.startsWith("@/lib/glw") ||
          entry.specifier.startsWith("@/app/glw") ||
          entry.specifier.startsWith("@/components/glw")
        ) {
          metrics.platformToGlwImports += 1;
          violations.push({
            ruleId: "ATLAS-DEP-001",
            file: file.relPath,
            line: entry.line,
            message: `Platform import points at application scope: ${entry.specifier}`,
          });
        }
      }
    }

    if (file.relPath === "src/lib/gop/platform-bootstrap-api.ts") {
      for (const entry of imports) {
        if (
          entry.specifier.startsWith("@/app/") ||
          entry.specifier.startsWith("@/components/glw") ||
          entry.specifier.startsWith("@/lib/glw")
        ) {
          metrics.bootstrapAppLeak += 1;
          violations.push({
            ruleId: "ATLAS-BST-001",
            file: file.relPath,
            line: entry.line,
            message: `Bootstrap API leaks application dependency: ${entry.specifier}`,
          });
        }
      }
    }

    if (file.relPath === "src/platform/gop/auth/authentication.ts") {
      const hits = collectPatternHits(text, /authorize|policy|permission|workspaceMembership|action/gi);
      metrics.authnPolicyTokens += hits.length;
      for (const hit of hits) {
        violations.push({
          ruleId: "ATLAS-AUTH-001",
          file: file.relPath,
          line: hit.line,
          message: `Authentication contains authorization concern token: ${hit.text}`,
        });
      }
    }

    if (file.relPath === "src/platform/gop/auth/authorization.ts") {
      const hits = collectPatternHits(text, /getGlwSession|createGlwSession|destroyGlwSession|validateGlwCredentials|cookies\(|password|token/gi);
      metrics.authzAuthnTokens += hits.length;
      for (const hit of hits) {
        violations.push({
          ruleId: "ATLAS-AUTH-002",
          file: file.relPath,
          line: hit.line,
          message: `Authorization contains authentication concern token: ${hit.text}`,
        });
      }
    }

    const prismaHits = collectPatternHits(text, /@prisma\/client|PrismaPg/g);
    if (prismaHits.length > 0) {
      const isPlatformPersistenceScope = file.relPath.startsWith("src/platform/gop/");
      const isAllowedPrismaPath =
        file.relPath === "src/platform/gop/runtime/prisma.ts" ||
        file.relPath.startsWith("src/platform/gop/persistence/");

      if (isPlatformPersistenceScope && !isAllowedPrismaPath) {
        for (const hit of prismaHits) {
          violations.push({
            ruleId: "ATLAS-PER-001",
            file: file.relPath,
            line: hit.line,
            message: `Prisma coupling found outside persistence boundary: ${hit.text}`,
          });
        }
      }
    }

    const workspaceLiteralHits = collectPatternHits(text, /glw-led-display-warehouse|GLW_WORKSPACE_ID/g);
    const inWorkspaceNormalizationScope = isWorkspaceNormalizationScope(file.relPath);
    if (inWorkspaceNormalizationScope) {
      metrics.workspaceLiteralCount += workspaceLiteralHits.length;
    }

    if (
      inWorkspaceNormalizationScope &&
      workspaceLiteralHits.length > 0 &&
      file.relPath !== CANONICAL_WORKSPACE_IDENTITY_FILE
    ) {
      for (const hit of workspaceLiteralHits) {
        violations.push({
          ruleId: "ATLAS-WS-001",
          file: file.relPath,
          line: hit.line,
          message: `Workspace identity literal found outside canonical identity module: ${hit.text}`,
        });
      }
    }
  }

  return { violations, metrics };
}

function printReport(outcome, jsonMode) {
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
    return;
  }

  process.stdout.write("Atlas Guardrails Report\n");
  process.stdout.write(`Scanned files: ${outcome.metrics.scannedFiles}\n`);
  process.stdout.write(`Violations: ${outcome.violations.length}\n`);
  process.stdout.write(`PLATFORM_TO_GLW_IMPORTS=${outcome.metrics.platformToGlwImports}\n`);
  process.stdout.write(`AUTHN_POLICY_TOKEN=${outcome.metrics.authnPolicyTokens}\n`);
  process.stdout.write(`AUTHZ_AUTHN_TOKEN=${outcome.metrics.authzAuthnTokens}\n`);
  process.stdout.write(`BOOTSTRAP_APP_LEAK=${outcome.metrics.bootstrapAppLeak}\n`);

  if (outcome.violations.length === 0) {
    process.stdout.write("ATLAS_GUARDRAILS_PASS\n");
    return;
  }

  for (const violation of outcome.violations) {
    process.stdout.write(`${violation.ruleId} ${violation.file}:${violation.line} ${violation.message}\n`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const outcome = evaluateRules(options.root);
  printReport(outcome, options.json);
  process.exit(outcome.violations.length === 0 ? 0 : 1);
}

main();
