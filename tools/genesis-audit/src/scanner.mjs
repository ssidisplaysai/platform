import fs from "fs";
import path from "path";
import ts from "typescript";
import {
  normalizePath,
  stableStringify,
  sha256Buffer,
  sha256Text,
  ensureDir,
  readTextSafe,
  isLikelyBinary,
  matchGlobLike,
  fileCategoryFromExtension,
  booleanFlagsForPath,
  topLevelSubsystem,
  depthOf,
  idFactory
} from "./utils.mjs";

function isExcludedDirectoryPath(relPath, config) {
  const normalized = normalizePath(relPath);
  if (normalized === "genesis/audits/GAR-0001" || normalized.startsWith("genesis/audits/GAR-0001/")) {
    return true;
  }
  const excludedNames = new Set((config.excludedContentBodies || []).map((x) => String(x).replace(/\/$/, "")));
  const parts = normalized.split("/").filter(Boolean);
  return parts.some((part) => excludedNames.has(part));
}

function walkRepository(rootDir, config) {
  const out = [];
  const stack = [""];
  while (stack.length > 0) {
    const rel = stack.pop();
    const abs = path.join(rootDir, rel);
    const entries = fs.readdirSync(abs, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const nextRel = rel ? path.join(rel, entry.name) : entry.name;
      const nextAbs = path.join(rootDir, nextRel);
      if (entry.isDirectory()) {
        const normalized = normalizePath(nextRel);
        if (isExcludedDirectoryPath(normalized, config)) {
          out.push({
            kind: "directory",
            relPath: normalized,
            skippedByPolicy: true,
            skipReason: "excluded-content-body"
          });
          continue;
        }
        out.push({ kind: "directory", relPath: normalized, skippedByPolicy: false, skipReason: null });
        stack.push(nextRel);
      } else if (entry.isFile()) {
        out.push({ kind: "file", relPath: normalizePath(nextRel), absPath: nextAbs });
      }
    }
  }
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function classifyFile(relPath, absPath, config) {
  const buffer = fs.readFileSync(absPath);
  const ext = path.extname(relPath);
  const category = fileCategoryFromExtension(ext);
  const flags = booleanFlagsForPath(relPath, category);
  const ignoredByPolicy = matchGlobLike(relPath, config.ignorePatterns || []);
  const ignoreReason = ignoredByPolicy ? "matches ignore pattern" : null;
  const isBinary = isLikelyBinary(buffer);
  const baseName = path.basename(relPath);
  const securitySensitiveByFilenamePattern =
    (config.securityFilenamePatterns || []).some((p) => baseName.toLowerCase().includes(p));

  return {
    relPath: normalizePath(relPath),
    normalizedPath: normalizePath(relPath).toLowerCase(),
    fileName: baseName,
    extension: ext,
    fileCategory: category,
    size: buffer.length,
    contentHash: sha256Buffer(buffer),
    parentDirectory: normalizePath(path.dirname(relPath)) === "." ? "" : normalizePath(path.dirname(relPath)),
    topLevelSubsystem: topLevelSubsystem(relPath),
    depth: depthOf(relPath),
    ...flags,
    securitySensitiveByFilenamePattern,
    ignoredByAuditPolicy: ignoredByPolicy,
    ignoreReason,
    isBinary,
    unsupported: !(ext || ["README", "LICENSE"].includes(baseName)),
    parserLimitations: isBinary ? "binary content not parsed" : null
  };
}

function extractSymbolsForSource(file, text, makeSymbolId, makeEdgeId) {
  const source = ts.createSourceFile(file.relPath, text, ts.ScriptTarget.Latest, true);
  const symbols = [];
  const imports = [];

  function pushSymbol(kind, name, node) {
    const pos = source.getLineAndCharacterOfPosition(node.getStart());
    symbols.push({
      symbolId: makeSymbolId(),
      file: file.relPath,
      kind,
      name,
      line: pos.line + 1,
      column: pos.character + 1
    });
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push({
        edgeId: makeEdgeId(),
        from: file.relPath,
        specifier: node.moduleSpecifier.text,
        kind: "verified static import"
      });
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push({
        edgeId: makeEdgeId(),
        from: file.relPath,
        specifier: node.moduleSpecifier.text,
        kind: "verified re-export"
      });
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length > 0) {
      const first = node.arguments[0];
      if (ts.isStringLiteral(first)) {
        imports.push({
          edgeId: makeEdgeId(),
          from: file.relPath,
          specifier: first.text,
          kind: "verified dynamic import"
        });
      }
    }

    if (ts.isClassDeclaration(node) && node.name) pushSymbol("class", node.name.text, node.name);
    if (ts.isInterfaceDeclaration(node)) pushSymbol("interface", node.name.text, node.name);
    if (ts.isTypeAliasDeclaration(node)) pushSymbol("type", node.name.text, node.name);
    if (ts.isEnumDeclaration(node)) pushSymbol("enum", node.name.text, node.name);
    if (ts.isFunctionDeclaration(node) && node.name) pushSymbol("function", node.name.text, node.name);
    if (ts.isVariableStatement(node)) {
      const isConst = node.declarationList.flags & ts.NodeFlags.Const;
      if (isConst) {
        node.declarationList.declarations.forEach((d) => {
          if (ts.isIdentifier(d.name)) pushSymbol("constant", d.name.text, d.name);
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return { symbols, imports };
}

function resolveImport(fromPath, specifier, allFilesSet) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
    return { to: null, resolved: false, external: true };
  }

  let base;
  if (specifier.startsWith("@/")) {
    base = specifier.replace("@/", "src/");
  } else {
    const fromDir = path.posix.dirname(fromPath);
    base = normalizePath(path.posix.join(fromDir, specifier));
  }

  const candidates = [
    base,
    `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.cjs`,
    `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`, `${base}/index.mjs`, `${base}/index.cjs`
  ];

  for (const c of candidates) {
    if (allFilesSet.has(normalizePath(c))) {
      return { to: normalizePath(c), resolved: true, external: false };
    }
  }
  return { to: null, resolved: false, external: false };
}

function tarjanScc(nodes, edges) {
  const adjacency = new Map();
  nodes.forEach((n) => adjacency.set(n, []));
  edges.forEach((e) => {
    if (e.to && adjacency.has(e.from) && adjacency.has(e.to)) adjacency.get(e.from).push(e.to);
  });

  let index = 0;
  const stack = [];
  const onStack = new Set();
  const idx = new Map();
  const low = new Map();
  const sccs = [];

  function strongConnect(v) {
    idx.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of adjacency.get(v) || []) {
      if (!idx.has(w)) {
        strongConnect(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), idx.get(w)));
      }
    }

    if (low.get(v) === idx.get(v)) {
      const scc = [];
      let w = null;
      while (w !== v) {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      }
      sccs.push(scc.sort());
    }
  }

  nodes.forEach((n) => {
    if (!idx.has(n)) strongConnect(n);
  });

  return sccs
    .filter((scc) => scc.length > 1)
    .sort((a, b) => a.join("|").localeCompare(b.join("|")));
}

function detectMethodsInRoute(text) {
  const methods = [];
  ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].forEach((m) => {
    const re = new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`);
    if (re.test(text)) methods.push(m);
  });
  return methods;
}

function extractMdMetadata(filePath, text) {
  const title = (text.match(/^#\s+(.+)$/m) || [null, null])[1];
  const idMatch = normalizePath(filePath).match(/([A-Z]{3,4}-\d{4}[A-Z]?)/);
  const statusMatch = text.match(/Status:\s*([^\n]+)/i);
  const versionMatch = text.match(/Version:\s*([^\n]+)/i);
  return {
    apparentTitle: title || path.basename(filePath),
    artifactIdentifier: idMatch ? idMatch[1] : null,
    apparentStatus: statusMatch ? statusMatch[1].trim() : null,
    apparentVersion: versionMatch ? versionMatch[1].trim() : null,
    referencedPackageIdentifiers: Array.from(new Set((text.match(/[A-Z]{3,4}-\d{4}[A-Z]?/g) || []).sort())),
    referencedPaths: Array.from(new Set((text.match(/([A-Za-z0-9_./-]+\.[a-zA-Z0-9]+)/g) || []).sort())),
    declaredOwnership: (text.match(/owner(ship)?\s*[:\-]\s*([^\n]+)/i) || [null, null, null])[2] || null,
    declaredDependencies: Array.from(new Set((text.match(/depends on\s+([^\n]+)/gi) || []).sort())),
    declaredCertifications: Array.from(new Set((text.match(/certification/gi) || []).sort())).length
  };
}

function extractEnvUsages(file, text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = line.match(/process\.env\.([A-Z0-9_]+)/g);
    if (m) {
      m.forEach((token) => {
        hits.push({ file: file.relPath, line: i + 1, token, confidence: "high" });
      });
    }
  }
  return hits;
}

function extractSecretLike(text, relPath) {
  const out = [];
  const lines = text.split(/\r?\n/);
  const patterns = [
    { category: "api-key-like", re: /(api[_-]?key\s*[:=]\s*)(["']?)[A-Za-z0-9_\-]{16,}\2/i },
    { category: "token-like", re: /(token\s*[:=]\s*)(["']?)[A-Za-z0-9_\-]{16,}\2/i },
    { category: "password-like", re: /(password\s*[:=]\s*)(["']?)[^\s"']{8,}\2/i }
  ];
  for (let i = 0; i < lines.length; i += 1) {
    for (const p of patterns) {
      const m = lines[i].match(p.re);
      if (m) {
        out.push({
          file: relPath,
          line: i + 1,
          category: p.category,
          confidence: "medium",
          redacted: `${m[1]}<REDACTED>`
        });
      }
    }
  }
  return out;
}

function determineTopLevelDirectoryCatalog(dirs) {
  const roots = dirs
    .filter((d) => !d.relPath.includes("/"))
    .map((d) => d.relPath)
    .sort();

  return roots.map((root) => ({
    root,
    classification: root.startsWith("src")
      ? "source-root"
      : root.startsWith("docs")
      ? "documentation-root"
      : root.startsWith("tests") || root.startsWith("test")
      ? "test-root"
      : root.startsWith("tools")
      ? "tooling-root"
      : root.startsWith("prisma")
      ? "migration-root"
      : root.startsWith("genesis")
      ? "governance-root"
      : "other"
  }));
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function schemaEnvelope(schemaId, scannerVersion, schemaVersion, generationMethod, limitations) {
  return {
    schemaIdentifier: schemaId,
    schemaVersion,
    scannerVersion,
    evidenceClassification: "VERIFIED",
    generationMethod,
    limitations
  };
}

function safeLinesCount(text) {
  if (text === null) return 0;
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

export function buildRepositoryHashSnapshot(files, outputPrefix) {
  const filtered = files
    .filter((f) => !normalizePath(f.relPath).startsWith(outputPrefix))
    .map((f) => `${f.relPath}:${f.contentHash}`)
    .sort();
  return {
    fileCount: filtered.length,
    snapshotHash: sha256Text(filtered.join("\n")),
    entries: filtered
  };
}

export function runScan({ rootDir, config, outputDir }) {
  const start = process.hrtime.bigint();

  const allEntries = walkRepository(rootDir, config);
  const directories = allEntries.filter((e) => e.kind === "directory");
  const filesRaw = allEntries.filter((e) => e.kind === "file");

  const makeFileId = idFactory("GAR1-FILE");
  const makeSymbolId = idFactory("GAR1-SYMBOL");
  const makeEdgeId = idFactory("GAR1-EDGE");
  const makeRouteId = idFactory("GAR1-ROUTE");
  const makeModelId = idFactory("GAR1-MODEL");
  const makeDocId = idFactory("GAR1-DOC");

  const files = filesRaw.map((f) => {
    const c = classifyFile(f.relPath, f.absPath, config);
    return { fileId: makeFileId(), ...c };
  }).sort((a, b) => a.relPath.localeCompare(b.relPath));

  const byPath = new Map(files.map((f) => [f.relPath, f]));
  const allFilesSet = new Set(files.map((f) => f.relPath));

  const sourceFiles = files.filter((f) => [".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(f.extension) && !f.isBinary);

  const symbolRecords = [];
  const importEdgesRaw = [];
  const unresolved = [];

  sourceFiles.forEach((f) => {
    const text = readTextSafe(path.join(rootDir, f.relPath));
    if (text === null) return;
    const parsed = extractSymbolsForSource(f, text, makeSymbolId, makeEdgeId);
    symbolRecords.push(...parsed.symbols);
    importEdgesRaw.push(...parsed.imports);
  });

  const importEdges = importEdgesRaw.map((edge) => {
    const resolved = resolveImport(edge.from, edge.specifier, allFilesSet);
    const finalEdge = {
      edgeId: edge.edgeId,
      from: edge.from,
      to: resolved.to,
      specifier: edge.specifier,
      classification: resolved.resolved ? edge.kind : resolved.external ? "inferred dependency" : "unresolved dependency",
      external: resolved.external,
      resolved: resolved.resolved
    };
    if (!resolved.resolved && !resolved.external) {
      unresolved.push({
        itemId: `GAR1-UNRESOLVED-IMPORT-${unresolved.length + 1}`,
        file: edge.from,
        specifier: edge.specifier,
        type: "unresolved-import"
      });
    }
    return finalEdge;
  }).sort((a, b) => `${a.from}|${a.specifier}|${a.to || ""}`.localeCompare(`${b.from}|${b.specifier}|${b.to || ""}`));

  const cycleGroups = tarjanScc(sourceFiles.map((f) => f.relPath), importEdges);

  const packageFiles = files.filter((f) => f.fileName === "package.json");
  const packageInventory = packageFiles.map((f) => {
    const obj = loadJson(path.join(rootDir, f.relPath)) || {};
    return {
      file: f.relPath,
      name: obj.name || null,
      version: obj.version || null,
      scripts: obj.scripts || {},
      dependencies: obj.dependencies || {},
      devDependencies: obj.devDependencies || {},
      peerDependencies: obj.peerDependencies || {},
      optionalDependencies: obj.optionalDependencies || {},
      workspaces: obj.workspaces || null
    };
  }).sort((a, b) => a.file.localeCompare(b.file));

  const lockfiles = files.filter((f) => /package-lock\.json|pnpm-lock\.yaml|yarn\.lock/.test(f.fileName)).map((f) => f.relPath);
  const tsConfigs = files.filter((f) => /^tsconfig.*\.json$/.test(f.fileName)).map((f) => f.relPath);
  const buildConfigs = files.filter((f) => /(next\.config|eslint\.config|jest\.config|postcss\.config|prisma\.config|dockerfile|compose|workflow)/i.test(f.relPath)).map((f) => f.relPath);

  const apiRoutes = files
    .filter((f) => f.relPath.startsWith("src/app/api/") && /\/route\.(ts|tsx|js|mjs|cjs)$/.test(f.relPath))
    .map((f) => {
      const text = readTextSafe(path.join(rootDir, f.relPath)) || "";
      const methods = detectMethodsInRoute(text);
      const imports = importEdges.filter((e) => e.from === f.relPath).map((e) => e.specifier).sort();
      return {
        routeId: makeRouteId(),
        routePath: `/${f.relPath.replace(/^src\/app\//, "").replace(/\/route\.(ts|tsx|js|mjs|cjs)$/, "")}`,
        sourceFile: f.relPath,
        supportedMethods: methods,
        importedServices: imports.filter((x) => /service/i.test(x)),
        importedRepositories: imports.filter((x) => /repositor/i.test(x)),
        importedAgents: imports.filter((x) => /agent/i.test(x)),
        directPrismaUsage: /prisma\./.test(text),
        authenticationChecksStaticallyVisible: /(auth|session|token)/i.test(text),
        authorizationChecksStaticallyVisible: /(authorize|permission|forbidden|denied)/i.test(text),
        requestValidationStaticallyVisible: /(zod|validate|schema)/i.test(text),
        responseConstruction: /(NextResponse|Response\.)/.test(text) ? "explicit" : "unknown",
        runtimeSelection: /export const runtime/.test(text) ? "declared" : "default",
        staticUncertainty: methods.length === 0 ? "no explicit method export found" : null
      };
    })
    .sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));

  const prismaFiles = files.filter((f) => f.extension === ".prisma");
  const prismaInventory = [];
  const persistenceAccess = [];

  prismaFiles.forEach((f) => {
    const text = readTextSafe(path.join(rootDir, f.relPath)) || "";
    const models = Array.from(text.matchAll(/^model\s+([A-Za-z0-9_]+)/gm)).map((m) => m[1]);
    const enums = Array.from(text.matchAll(/^enum\s+([A-Za-z0-9_]+)/gm)).map((m) => m[1]);
    const generators = Array.from(text.matchAll(/^generator\s+([A-Za-z0-9_]+)/gm)).map((m) => m[1]);
    const datasources = Array.from(text.matchAll(/^datasource\s+([A-Za-z0-9_]+)/gm)).map((m) => m[1]);

    models.forEach((m) => prismaInventory.push({ modelId: makeModelId(), file: f.relPath, model: m, kind: "model" }));
    enums.forEach((e) => prismaInventory.push({ modelId: makeModelId(), file: f.relPath, model: e, kind: "enum" }));

    persistenceAccess.push({
      file: f.relPath,
      generators,
      datasources,
      models,
      enums
    });
  });

  sourceFiles.forEach((f) => {
    const text = readTextSafe(path.join(rootDir, f.relPath)) || "";
    if (/prisma\./.test(text) || /new PrismaClient/.test(text)) {
      persistenceAccess.push({
        file: f.relPath,
        directDatabaseClientUsage: true,
        repositoryAbstractionLikely: /repository/i.test(f.fileName) || /repository/i.test(text)
      });
    }
  });

  const testFiles = files.filter((f) => f.isTest || /(spec|test)\.(ts|tsx|js|mjs|cjs)$/.test(f.relPath));
  const testInventory = testFiles.map((f) => {
    const text = readTextSafe(path.join(rootDir, f.relPath)) || "";
    const names = Array.from(text.matchAll(/(?:it|test|describe)\s*\(\s*["'`](.+?)["'`]/g)).map((m) => m[1]);
    const refs = Array.from(text.matchAll(/from\s+["'`](.+?)["'`]/g)).map((m) => m[1]);
    return {
      file: f.relPath,
      framework: /jest|@jest/.test(text) ? "jest" : "unknown",
      suiteNames: names,
      referencedSources: refs,
      hasFixtures: /fixture/i.test(text),
      hasMocks: /mock/i.test(text),
      hasSnapshots: /snapshot/i.test(text),
      integrationLikely: /integration/i.test(f.relPath),
      unitLikely: /unit/i.test(f.relPath),
      performanceLikely: /performance|benchmark/i.test(f.relPath),
      replayLikely: /replay/i.test(f.relPath),
      certificationLikely: /certification/i.test(f.relPath)
    };
  }).sort((a, b) => a.file.localeCompare(b.file));

  const mdFiles = files.filter((f) => f.extension === ".md");
  const documentationInventory = [];
  const governanceInventory = [];

  mdFiles.forEach((f) => {
    const text = readTextSafe(path.join(rootDir, f.relPath)) || "";
    const meta = extractMdMetadata(f.relPath, text);
    const record = {
      docId: makeDocId(),
      file: f.relPath,
      ...meta,
      contentHash: byPath.get(f.relPath)?.contentHash || null,
      lineCount: safeLinesCount(text)
    };
    documentationInventory.push(record);
    if (/(constitution|governance|certification|validation|freeze|readiness|architecture|compliance)/i.test(f.relPath) || /(Status:|Disposition:)/i.test(text)) {
      governanceInventory.push(record);
    }
  });

  const registryInventory = sourceFiles
    .filter((f) => /registry/i.test(f.relPath))
    .map((f) => {
      const text = readTextSafe(path.join(rootDir, f.relPath)) || "";
      const imports = importEdges.filter((e) => e.from === f.relPath).map((e) => e.specifier);
      return {
        registryName: path.basename(f.relPath, path.extname(f.relPath)),
        location: f.relPath,
        implementationType: /class\s+/m.test(text) ? "class" : "module",
        staticOrRuntime: /runtime/i.test(f.relPath) ? "runtime" : "static",
        registeredItemType: /register/i.test(text) ? "inferred-from-register-calls" : "unknown",
        registrationMechanism: /register\(/.test(text) ? "function-call" : "not-detected",
        consumers: imports,
        duplicateIdentifiers: [],
        missingIdentifiers: [],
        apparentOrphanRegistrations: []
      };
    })
    .sort((a, b) => a.location.localeCompare(b.location));

  const securitySurface = {
    envUsages: [],
    envTemplates: files.filter((f) => /^\.env/.test(f.fileName)).map((f) => f.relPath),
    secretLikeFiles: files.filter((f) => f.securitySensitiveByFilenamePattern).map((f) => f.relPath),
    suspectedSecrets: [],
    authenticationModules: sourceFiles.filter((f) => /auth/i.test(f.relPath)).map((f) => f.relPath),
    authorizationModules: sourceFiles.filter((f) => /authoriz|permission|polic/i.test(f.relPath)).map((f) => f.relPath),
    cryptographyUsage: [],
    tokenHandling: [],
    cookieHandling: [],
    sessionHandling: [],
    directDatabaseAccess: [],
    externalNetworkCalls: [],
    fileSystemWrites: [],
    shellExecution: [],
    dynamicCodeExecution: [],
    unsafeDeserializationIndicators: []
  };

  sourceFiles.forEach((f) => {
    const text = readTextSafe(path.join(rootDir, f.relPath)) || "";
    securitySurface.envUsages.push(...extractEnvUsages(f, text));
    securitySurface.suspectedSecrets.push(...extractSecretLike(text, f.relPath));
    if (/crypto\./.test(text) || /timingSafeEqual/.test(text)) securitySurface.cryptographyUsage.push(f.relPath);
    if (/token/i.test(text)) securitySurface.tokenHandling.push(f.relPath);
    if (/cookie/i.test(text)) securitySurface.cookieHandling.push(f.relPath);
    if (/session/i.test(text)) securitySurface.sessionHandling.push(f.relPath);
    if (/prisma\.|new PrismaClient/.test(text)) securitySurface.directDatabaseAccess.push(f.relPath);
    if (/fetch\(|axios|http[s]?:\/\//.test(text)) securitySurface.externalNetworkCalls.push(f.relPath);
    if (/writeFile|appendFile|mkdirSync|createWriteStream/.test(text)) securitySurface.fileSystemWrites.push(f.relPath);
    if (/exec\(|spawn\(|child_process/.test(text)) securitySurface.shellExecution.push(f.relPath);
    if (/eval\(|new Function\(/.test(text)) securitySurface.dynamicCodeExecution.push(f.relPath);
    if (/yaml\.load|deserialize|JSON\.parse\(/.test(text)) securitySurface.unsafeDeserializationIndicators.push(f.relPath);
  });

  const hygieneInventory = {
    todoFindings: [],
    deprecatedMarkers: [],
    backupFiles: files.filter((f) => /backup|\.bak$|\.old$|\.tmp$/.test(f.relPath)).map((f) => f.relPath),
    temporaryFiles: files.filter((f) => /(^|\/)\.tmp-|temp/.test(f.relPath)).map((f) => f.relPath),
    generatedTrackedFiles: files.filter((f) => f.isGenerated).map((f) => f.relPath),
    testResultDumps: files.filter((f) => /test[-_].*output|test[-_]?results/i.test(f.relPath)).map((f) => f.relPath),
    duplicateFileNames: [],
    unusuallyLargeSourceFiles: files.filter((f) => f.isSource && f.size > config.largeFileBytes).map((f) => f.relPath),
    emptyFiles: files.filter((f) => f.size === 0).map((f) => f.relPath),
    likelyDeadEntrypoints: [],
    potentiallyOrphanedModules: []
  };

  const nameToPaths = new Map();
  files.forEach((f) => {
    const arr = nameToPaths.get(f.fileName) || [];
    arr.push(f.relPath);
    nameToPaths.set(f.fileName, arr);
  });
  for (const [name, paths] of nameToPaths) {
    if (paths.length > 1) hygieneInventory.duplicateFileNames.push({ fileName: name, paths: paths.sort() });
  }

  sourceFiles.forEach((f) => {
    const text = readTextSafe(path.join(rootDir, f.relPath)) || "";
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (/TODO|FIXME|HACK|XXX/.test(line)) {
        hygieneInventory.todoFindings.push({ file: f.relPath, line: idx + 1, marker: line.trim() });
      }
      if (/deprecated/i.test(line)) {
        hygieneInventory.deprecatedMarkers.push({ file: f.relPath, line: idx + 1, marker: line.trim() });
      }
    });
  });

  const inbound = new Map(sourceFiles.map((f) => [f.relPath, 0]));
  importEdges.forEach((e) => {
    if (e.to && inbound.has(e.to)) inbound.set(e.to, (inbound.get(e.to) || 0) + 1);
  });
  hygieneInventory.potentiallyOrphanedModules = sourceFiles
    .filter((f) => (inbound.get(f.relPath) || 0) === 0)
    .map((f) => f.relPath)
    .sort();

  const unresolvedItems = [
    ...unresolved,
    ...files.filter((f) => f.unsupported).map((f, idx) => ({
      itemId: `GAR1-UNRESOLVED-FILETYPE-${idx + 1}`,
      file: f.relPath,
      type: "unknown-file-type"
    }))
  ];

  const topLevelCatalog = determineTopLevelDirectoryCatalog(directories);

  const repositoryManifest = {
    ...schemaEnvelope("gar-0001/repository-manifest", config.scannerVersion, config.schemaVersion, config.generationMethod, ["static analysis only"]),
    packageId: config.packageId,
    totalFiles: files.length,
    totalDirectories: directories.length,
    skippedDirectories: directories.filter((d) => d.skippedByPolicy).length,
    skippedDirectoryPaths: directories
      .filter((d) => d.skippedByPolicy)
      .map((d) => d.relPath)
      .sort(),
    rootCatalog: topLevelCatalog,
    lockfiles,
    tsConfigs,
    buildConfigs
  };

  const out = {
    "repository-manifest.json": repositoryManifest,
    "directory-inventory.json": {
      ...schemaEnvelope("gar-0001/directory-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["folder ownership may be inferred"]),
      directories: directories.map((d) => ({
        path: d.relPath,
        depth: depthOf(d.relPath),
        topLevelSubsystem: topLevelSubsystem(d.relPath),
        skippedByPolicy: Boolean(d.skippedByPolicy),
        skipReason: d.skipReason || null,
        inferredOwnership: "inferred"
      }))
    },
    "file-inventory.json": {
      ...schemaEnvelope("gar-0001/file-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["binary bodies not semantically parsed"]),
      files
    },
    "package-inventory.json": {
      ...schemaEnvelope("gar-0001/package-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["workspace manager inferred from lockfiles"]),
      packages: packageInventory,
      lockfiles,
      tsConfigs,
      buildConfigs,
      conflictingBuildConfigSignals: buildConfigs.filter((x) => /vite|webpack|next\.config/i.test(x)).sort()
    },
    "source-symbol-inventory.json": {
      ...schemaEnvelope("gar-0001/source-symbol-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["parser coverage limited to TS/JS AST"]),
      symbols: symbolRecords.sort((a, b) => `${a.file}|${a.kind}|${a.name}|${a.line}`.localeCompare(`${b.file}|${b.kind}|${b.name}|${b.line}`))
    },
    "import-graph.json": {
      ...schemaEnvelope("gar-0001/import-graph", config.scannerVersion, config.schemaVersion, config.generationMethod, ["dynamic runtime resolution not executed"]),
      nodes: sourceFiles.map((f) => f.relPath).sort(),
      edges: importEdges
    },
    "circular-dependency-report.json": {
      ...schemaEnvelope("gar-0001/circular-dependency-report", config.scannerVersion, config.schemaVersion, config.generationMethod, ["SCCs are structural, not automatically defects"]),
      stronglyConnectedComponents: cycleGroups
    },
    "api-route-inventory.json": {
      ...schemaEnvelope("gar-0001/api-route-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["security observations are static only"]),
      routes: apiRoutes
    },
    "prisma-inventory.json": {
      ...schemaEnvelope("gar-0001/prisma-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["field-level semantics partially inferred"]),
      prismaFiles: prismaFiles.map((f) => f.relPath),
      entities: prismaInventory
    },
    "persistence-access-inventory.json": {
      ...schemaEnvelope("gar-0001/persistence-access-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["runtime query paths are not executed"]),
      accesses: persistenceAccess.sort((a, b) => a.file.localeCompare(b.file))
    },
    "test-inventory.json": {
      ...schemaEnvelope("gar-0001/test-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["coverage percentages not measured"]),
      tests: testInventory
    },
    "documentation-inventory.json": {
      ...schemaEnvelope("gar-0001/documentation-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["metadata extraction is heuristic"]),
      documents: documentationInventory.sort((a, b) => a.file.localeCompare(b.file))
    },
    "governance-artifact-inventory.json": {
      ...schemaEnvelope("gar-0001/governance-artifact-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["self-declared certifications are not independently verified"]),
      artifacts: governanceInventory.sort((a, b) => a.file.localeCompare(b.file))
    },
    "registry-inventory.json": {
      ...schemaEnvelope("gar-0001/registry-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["registry item identity may require runtime confirmation"]),
      registries: registryInventory
    },
    "security-surface-inventory.json": {
      ...schemaEnvelope("gar-0001/security-surface-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["secret values are redacted", "no dynamic exploitability testing"]),
      securitySurface
    },
    "hygiene-inventory.json": {
      ...schemaEnvelope("gar-0001/hygiene-inventory", config.scannerVersion, config.schemaVersion, config.generationMethod, ["orphaned modules are potential only"]),
      hygiene: hygieneInventory
    },
    "unresolved-analysis-items.json": {
      ...schemaEnvelope("gar-0001/unresolved-analysis-items", config.scannerVersion, config.schemaVersion, config.generationMethod, ["contains parser and resolution limitations"]),
      unresolvedItems: unresolvedItems.sort((a, b) => a.itemId.localeCompare(b.itemId))
    }
  };

  const snapshotBefore = buildRepositoryHashSnapshot(files, "genesis/audits/GAR-0001/");

  ensureDir(outputDir);
  const outputHashes = [];
  for (const [name, payload] of Object.entries(out).sort((a, b) => a[0].localeCompare(b[0]))) {
    const p = path.join(outputDir, name);
    const text = stableStringify(payload);
    fs.writeFileSync(p, text, "utf8");
    outputHashes.push({ file: name, hash: sha256Text(text) });
  }

  const elapsedMs = Number((process.hrtime.bigint() - start) / 1000000n);

  const auditRunManifest = {
    ...schemaEnvelope("gar-0001/audit-run-manifest", config.scannerVersion, config.schemaVersion, config.generationMethod, ["performance metrics are process-local"]),
    packageId: config.packageId,
    totals: {
      filesScanned: files.length,
      bytesScanned: files.reduce((sum, f) => sum + f.size, 0),
      sourceFiles: sourceFiles.length,
      directories: directories.length,
      symbols: symbolRecords.length,
      graphNodes: sourceFiles.length,
      graphEdges: importEdges.length,
      unresolvedImports: unresolved.length,
      malformedFiles: files.filter((f) => f.isBinary).length,
      unsupportedFiles: files.filter((f) => f.unsupported).length
    },
    performance: {
      totalRuntimeMs: elapsedMs,
      parsing: {
        sourceAstFiles: sourceFiles.length,
        apiRouteFiles: apiRoutes.length,
        prismaFiles: prismaFiles.length,
        markdownFiles: mdFiles.length
      }
    },
    outputHashes: outputHashes.sort((a, b) => a.file.localeCompare(b.file)),
    repositoryMutationGuard: {
      preOutputSnapshot: snapshotBefore,
      postOutputSnapshot: null,
      mutated: null
    }
  };

  fs.writeFileSync(path.join(outputDir, "audit-run-manifest.json"), stableStringify(auditRunManifest), "utf8");

  return {
    files,
    outputHashes,
    snapshotBefore,
    output: out,
    elapsedMs,
    totals: auditRunManifest.totals
  };
}
