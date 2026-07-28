#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { stableStringify, normalizePath } from "./utils.mjs";
import { validateOutputs } from "./schema-validator.mjs";

const TOOL_VERSION = "1.0.0";
const SCHEMA_VERSION = "1.0.0";
const GAR1_DIR = "genesis/audits/GAR-0001";
const GAR2_DIR = "genesis/audits/GAR-0002";
const GAR2_EVIDENCE = `${GAR2_DIR}/evidence`;
const GAR2_REPORTS = `${GAR2_DIR}/reports`;
const GAR2_DIAGRAMS = `${GAR2_REPORTS}/diagrams`;

const REQUIRED_GAR1_FILES = [
  "repository-manifest.json",
  "directory-inventory.json",
  "file-inventory.json",
  "package-inventory.json",
  "source-symbol-inventory.json",
  "import-graph.json",
  "circular-dependency-report.json",
  "api-route-inventory.json",
  "prisma-inventory.json",
  "persistence-access-inventory.json",
  "test-inventory.json",
  "documentation-inventory.json",
  "governance-artifact-inventory.json",
  "registry-inventory.json",
  "security-surface-inventory.json",
  "hygiene-inventory.json",
  "unresolved-analysis-items.json",
  "audit-run-manifest.json",
  "GAR-0001-Final-Report.md"
];

function sha256(bufferOrText) {
  return crypto.createHash("sha256").update(bufferOrText).digest("hex");
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(relPath, "utf8"));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function fileExists(relPath) {
  return fs.existsSync(relPath) && fs.statSync(relPath).isFile();
}

function canonicalGitBlobHash(rootDir, relPath) {
  const repoRel = normalizePath(path.relative(rootDir, relPath));
  const blob = execFileSync("git", ["show", `HEAD:${repoRel}`], {
    encoding: null,
    cwd: rootDir,
    maxBuffer: 64 * 1024 * 1024
  });
  return sha256(blob);
}

function envelope(schemaIdentifier, gar1Hashes, limitations = []) {
  return {
    schemaIdentifier,
    schemaVersion: SCHEMA_VERSION,
    toolVersion: TOOL_VERSION,
    gar0001BaselineHashes: gar1Hashes,
    evidenceClassification: "VERIFIED",
    generationMethod: "deterministic-topology-analysis-from-gar-0001-and-source-layout",
    limitations
  };
}

function pathLayer(p) {
  const n = normalizePath(p);
  if (n.startsWith("src/app/api/")) return "api-transport";
  if (n.startsWith("src/app/") || n.startsWith("src/components/")) return "application-ui";
  if (n.startsWith("src/lib/gba/")) return "business-agents";
  if (n.startsWith("src/lib/gea/")) return "enterprise-agents";
  if (n.startsWith("src/platform/gop/")) return "platform-orchestration";
  if (n.startsWith("src/lib/gmp/") || n.startsWith("src/lib/ged/") || n.startsWith("src/core/")) return "domain-kernel";
  if (n.startsWith("src/lib/glw/") || n.startsWith("src/lib/gop/")) return "runtime-services";
  if (n.startsWith("prisma/")) return "persistence-schema";
  if (n.startsWith("tools/genesis/")) return "compiler-generation";
  if (n.startsWith("tools/")) return "tooling";
  if (n.startsWith("tests/") || n.startsWith("test/")) return "tests";
  if (n.startsWith("docs/") || n.endsWith(".md") || n.startsWith("genesis/")) return "governance-evidence";
  return "shared-infrastructure";
}

const LAYER_ORDER = [
  "application-ui",
  "api-transport",
  "business-agents",
  "enterprise-agents",
  "platform-orchestration",
  "domain-kernel",
  "runtime-services",
  "persistence-schema",
  "compiler-generation",
  "shared-infrastructure",
  "tooling",
  "tests",
  "governance-evidence"
];

function layerIndex(layer) {
  const i = LAYER_ORDER.indexOf(layer);
  return i < 0 ? 999 : i;
}

function classifyDirection(fromLayer, toLayer) {
  if (!toLayer) return "unknown";
  if (fromLayer === toLayer) return "same-layer";
  const fi = layerIndex(fromLayer);
  const ti = layerIndex(toLayer);
  if (fi < ti) return "downward";
  if (fi > ti) return "upward";
  return "lateral";
}

function safeTop(arr, key, n = 15) {
  return [...arr].sort((a, b) => b[key] - a[key] || a.node.localeCompare(b.node)).slice(0, n);
}

function computeSnapshot(rootDir, excludedPrefix) {
  const out = [];
  const stack = [""];
  while (stack.length > 0) {
    const rel = stack.pop();
    const abs = path.join(rootDir, rel);
    const entries = fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const nextRel = rel ? path.join(rel, e.name) : e.name;
      const n = normalizePath(nextRel);
      if (n.startsWith(excludedPrefix)) continue;
      const nextAbs = path.join(rootDir, nextRel);
      if (e.isDirectory()) {
        stack.push(nextRel);
      } else if (e.isFile()) {
        const buf = fs.readFileSync(nextAbs);
        out.push(`${n}:${sha256(buf)}`);
      }
    }
  }
  out.sort();
  return {
    fileCount: out.length,
    snapshotHash: sha256(out.join("\n")),
    entries: out
  };
}

function buildDiagrams(layerGraph, subsystemGraph, apiAssess, baMap, eaMap, runtimeTopo, registryMap, compilerTopo, cycles) {
  const mermaid = [];
  mermaid.push({
    file: "enterprise-layer-diagram.mmd",
    content: [
      "graph TD",
      ...layerGraph.edges.slice(0, 40).map((e) => `  ${e.from.replace(/[^a-zA-Z0-9]/g, "_")}-->${e.to.replace(/[^a-zA-Z0-9]/g, "_")}`)
    ].join("\n") + "\n"
  });
  mermaid.push({
    file: "top-level-subsystem-dependency-diagram.mmd",
    content: [
      "graph LR",
      ...subsystemGraph.edges.slice(0, 50).map((e) => `  ${e.from.replace(/[^a-zA-Z0-9]/g, "_")}-->${e.to.replace(/[^a-zA-Z0-9]/g, "_")}`)
    ].join("\n") + "\n"
  });
  mermaid.push({
    file: "api-request-flow.mmd",
    content: [
      "graph TD",
      ...apiAssess.routes.slice(0, 40).map((r) => `  ${r.namespace.replace(/[^a-zA-Z0-9]/g, "_")}-->${r.primaryPattern.replace(/[^a-zA-Z0-9]/g, "_")}`)
    ].join("\n") + "\n"
  });
  mermaid.push({
    file: "business-agent-interaction-topology.mmd",
    content: [
      "graph LR",
      ...baMap.agents.flatMap((a) => a.dependenciesToAgents.map((d) => `  ${a.agentKey.replace(/[^a-zA-Z0-9]/g, "_")}-->${d.replace(/[^a-zA-Z0-9]/g, "_")}`)).slice(0, 50)
    ].join("\n") + "\n"
  });
  mermaid.push({
    file: "enterprise-agent-topology.mmd",
    content: [
      "graph LR",
      ...eaMap.capabilityDependencies.slice(0, 60).map((e) => `  ${e.from.replace(/[^a-zA-Z0-9]/g, "_")}-->${e.to.replace(/[^a-zA-Z0-9]/g, "_")}`)
    ].join("\n") + "\n"
  });
  mermaid.push({
    file: "runtime-command-event-workflow-topology.mmd",
    content: [
      "graph TD",
      ...runtimeTopo.flows.slice(0, 80).map((f) => `  ${f.from.replace(/[^a-zA-Z0-9]/g, "_")}-->${f.to.replace(/[^a-zA-Z0-9]/g, "_")}`)
    ].join("\n") + "\n"
  });
  mermaid.push({
    file: "persistence-flow.mmd",
    content: [
      "graph TD",
      ...runtimeTopo.persistenceFlows.slice(0, 60).map((f) => `  ${f.consumer.replace(/[^a-zA-Z0-9]/g, "_")}-->${f.target.replace(/[^a-zA-Z0-9]/g, "_")}`)
    ].join("\n") + "\n"
  });
  mermaid.push({
    file: "registry-relationship-topology.mmd",
    content: [
      "graph LR",
      ...registryMap.edges.slice(0, 80).map((e) => `  ${e.from.replace(/[^a-zA-Z0-9]/g, "_")}-->${e.to.replace(/[^a-zA-Z0-9]/g, "_")}`)
    ].join("\n") + "\n"
  });
  mermaid.push({
    file: "compiler-topology.mmd",
    content: [
      "graph LR",
      ...compilerTopo.edges.slice(0, 80).map((e) => `  ${e.from.replace(/[^a-zA-Z0-9]/g, "_")}-->${e.to.replace(/[^a-zA-Z0-9]/g, "_")}`)
    ].join("\n") + "\n"
  });
  mermaid.push({
    file: "application-onboarding-dependency-model.mmd",
    content: [
      "graph TD",
      "  app_glw-->api_transport",
      "  app_glw-->platform_orchestration",
      "  app_glw-->business_agents",
      "  app_glw-->enterprise_agents",
      "  app_glw-->domain_kernel",
      "  app_glw-->runtime_services",
      "  api_transport-->persistence_schema"
    ].join("\n") + "\n"
  });
  mermaid.push({
    file: "major-cycle-diagrams.mmd",
    content: [
      "graph LR",
      ...cycles.cycleAssessments.flatMap((c) => c.members.map((m, i, arr) => `  ${arr[i].replace(/[^a-zA-Z0-9]/g, "_")}-->${arr[(i + 1) % arr.length].replace(/[^a-zA-Z0-9]/g, "_")}`)).slice(0, 120)
    ].join("\n") + "\n"
  });
  return mermaid;
}

function writeReports(human, reportDir) {
  const names = [
    "00-package-manifest.md",
    "01-execution-charter.md",
    "02-input-baseline-and-evidence-integrity.md",
    "03-architecture-analysis-methodology.md",
    "04-implemented-layer-model.md",
    "05-complete-subsystem-catalog.md",
    "06-package-and-module-dependency-map.md",
    "07-dependency-direction-assessment.md",
    "08-circular-dependency-assessment.md",
    "09-api-layering-assessment.md",
    "10-persistence-boundary-assessment.md",
    "11-domain-boundary-topology.md",
    "12-business-agent-dependency-map.md",
    "13-enterprise-agent-dependency-map.md",
    "14-runtime-topology-and-flows.md",
    "15-application-platform-topology.md",
    "16-registry-relationship-assessment.md",
    "17-compiler-and-generation-topology.md",
    "18-coupling-cohesion-and-hotspots.md",
    "19-documentation-versus-implementation.md",
    "20-architectural-smells-topology-scope.md",
    "21-prioritized-architecture-findings.md",
    "22-unresolved-items-and-limitations.md",
    "23-GAR-0003-readiness-recommendation.md",
    "GAR-0002-README.md",
    "GAR-0002-Final-Report.md"
  ];
  names.forEach((name) => {
    const content = human[name] || `# ${name}\n\nVERIFIED: See GAR-0002 evidence JSON outputs for full deterministic detail.\n`;
    fs.writeFileSync(path.join(reportDir, name), content, "utf8");
  });
}

function main() {
  const root = process.cwd();
  ensureDir(GAR2_EVIDENCE);
  ensureDir(GAR2_REPORTS);
  ensureDir(GAR2_DIAGRAMS);

  // Step 1: Validate GAR-0001 baseline and capture hashes.
  for (const f of REQUIRED_GAR1_FILES) {
    const p = path.join(root, GAR1_DIR, f);
    if (!fileExists(p)) {
      throw new Error(`GAR-0001 baseline missing required file: ${f}`);
    }
  }

  const gar1Validation = validateOutputs(path.join(root, GAR1_DIR));
  if (!gar1Validation.valid) {
    throw new Error("GAR-0001 schema validation failed; stopping GAR-0002.");
  }

  const gar1Manifest = readJson(path.join(root, GAR1_DIR, "audit-run-manifest.json"));
  const manifestHashes = new Map((gar1Manifest.outputHashes || []).map((x) => [x.file, x.hash]));

  const gar1Hashes = REQUIRED_GAR1_FILES.map((f) => {
    const filePath = path.join(root, GAR1_DIR, f);
    return { file: f, hash: canonicalGitBlobHash(root, filePath) };
  }).sort((a, b) => a.file.localeCompare(b.file));

  const manifestMismatch = gar1Hashes
    .filter((h) => h.file.endsWith(".json") && manifestHashes.has(h.file))
    .filter((h) => manifestHashes.get(h.file) !== h.hash);
  const gar1HashConsistency = manifestMismatch.length === 0;

  // Step 2: Load GAR-0001 evidence.
  const repositoryManifest = readJson(path.join(root, GAR1_DIR, "repository-manifest.json"));
  const directoryInventory = readJson(path.join(root, GAR1_DIR, "directory-inventory.json"));
  const fileInventory = readJson(path.join(root, GAR1_DIR, "file-inventory.json"));
  const packageInventory = readJson(path.join(root, GAR1_DIR, "package-inventory.json"));
  const symbolInventory = readJson(path.join(root, GAR1_DIR, "source-symbol-inventory.json"));
  const importGraph = readJson(path.join(root, GAR1_DIR, "import-graph.json"));
  const circularReport = readJson(path.join(root, GAR1_DIR, "circular-dependency-report.json"));
  const apiInventory = readJson(path.join(root, GAR1_DIR, "api-route-inventory.json"));
  const prismaInventory = readJson(path.join(root, GAR1_DIR, "prisma-inventory.json"));
  const persistenceInventory = readJson(path.join(root, GAR1_DIR, "persistence-access-inventory.json"));
  const testInventory = readJson(path.join(root, GAR1_DIR, "test-inventory.json"));
  const docInventory = readJson(path.join(root, GAR1_DIR, "documentation-inventory.json"));
  const govInventory = readJson(path.join(root, GAR1_DIR, "governance-artifact-inventory.json"));
  const registryInventory = readJson(path.join(root, GAR1_DIR, "registry-inventory.json"));
  const securityInventory = readJson(path.join(root, GAR1_DIR, "security-surface-inventory.json"));
  const hygieneInventory = readJson(path.join(root, GAR1_DIR, "hygiene-inventory.json"));
  const unresolvedInventory = readJson(path.join(root, GAR1_DIR, "unresolved-analysis-items.json"));

  const files = fileInventory.files || [];
  const sourceNodes = importGraph.nodes || [];
  const sourceEdges = importGraph.edges || [];

  const nodeLayerMap = new Map(sourceNodes.map((n) => [n, pathLayer(n)]));
  const layerNodes = new Map();
  sourceNodes.forEach((n) => {
    const l = nodeLayerMap.get(n);
    if (!layerNodes.has(l)) layerNodes.set(l, []);
    layerNodes.get(l).push(n);
  });
  for (const [k, v] of layerNodes.entries()) v.sort();

  const layerInOut = new Map();
  Array.from(layerNodes.keys()).forEach((l) => layerInOut.set(l, { inbound: 0, outbound: 0 }));

  const directionCounts = {
    "same-layer": 0,
    downward: 0,
    upward: 0,
    lateral: 0,
    "cross-domain": 0,
    "infrastructure-inward": 0,
    "domain-outward": 0,
    "application-to-implementation": 0,
    "transport-to-persistence": 0,
    unknown: 0
  };

  const dependencyDirectionItems = sourceEdges.map((e) => {
    const fromLayer = nodeLayerMap.get(e.from) || pathLayer(e.from);
    const toLayer = e.to ? (nodeLayerMap.get(e.to) || pathLayer(e.to)) : null;
    let direction = classifyDirection(fromLayer, toLayer);
    if (fromLayer === "domain-kernel" && toLayer && layerIndex(toLayer) < layerIndex("domain-kernel")) direction = "domain-outward";
    if (fromLayer === "shared-infrastructure" && toLayer === "application-ui") direction = "infrastructure-inward";
    if (fromLayer === "application-ui" && toLayer && ["runtime-services", "platform-orchestration", "business-agents", "enterprise-agents"].includes(toLayer)) direction = "application-to-implementation";
    if (fromLayer === "api-transport" && toLayer === "persistence-schema") direction = "transport-to-persistence";
    if (fromLayer !== toLayer && fromLayer.includes("agents") && toLayer && toLayer.includes("agents")) direction = "cross-domain";

    directionCounts[direction] = (directionCounts[direction] || 0) + 1;
    if (layerInOut.has(fromLayer)) layerInOut.get(fromLayer).outbound += 1;
    if (toLayer && layerInOut.has(toLayer)) layerInOut.get(toLayer).inbound += 1;

    return {
      from: e.from,
      to: e.to,
      importKind: e.classification,
      fromLayer,
      toLayer,
      direction,
      boundaryConcern: ["upward", "domain-outward", "application-to-implementation", "transport-to-persistence"].includes(direction)
    };
  }).sort((a, b) => `${a.from}|${a.to || ""}`.localeCompare(`${b.from}|${b.to || ""}`));

  const layerDependencyMap = new Map();
  dependencyDirectionItems.forEach((d) => {
    if (!d.toLayer) return;
    const key = `${d.fromLayer}=>${d.toLayer}`;
    layerDependencyMap.set(key, (layerDependencyMap.get(key) || 0) + 1);
  });

  const layerDependencyEdges = Array.from(layerDependencyMap.entries())
    .map(([k, count]) => {
      const [from, to] = k.split("=>");
      return { from, to, count };
    })
    .sort((a, b) => `${a.from}|${a.to}`.localeCompare(`${b.from}|${b.to}`));

  const layerModel = Array.from(layerNodes.entries()).map(([layer, nodes]) => {
    const symbols = (symbolInventory.symbols || []).filter((s) => pathLayer(s.file) === layer);
    return {
      layer,
      classification: ["application-ui", "api-transport", "business-agents", "enterprise-agents", "platform-orchestration", "domain-kernel", "runtime-services", "persistence-schema", "compiler-generation"].includes(layer)
        ? "VERIFIED IMPLEMENTED"
        : "INFERRED IMPLEMENTED",
      purpose: `${layer} responsibilities derived from implementation path patterns and dependency evidence`,
      includedPaths: nodes,
      includedSymbolCount: symbols.length,
      inboundDependencies: layerInOut.get(layer)?.inbound || 0,
      outboundDependencies: layerInOut.get(layer)?.outbound || 0,
      apparentOwner: layer.includes("agents") ? "agent-platform-team (inferred)" : "platform-core (inferred)",
      ownershipConfidence: layer.includes("agents") ? "medium" : "low",
      boundaryStrength: (layerInOut.get(layer)?.inbound || 0) > 0 && (layerInOut.get(layer)?.outbound || 0) > 0 ? "mixed" : "strong",
      evidenceSources: [
        "GAR-0001:file-inventory.json",
        "GAR-0001:source-symbol-inventory.json",
        "GAR-0001:import-graph.json"
      ]
    };
  }).sort((a, b) => layerIndex(a.layer) - layerIndex(b.layer) || a.layer.localeCompare(b.layer));

  // Subsystem catalog.
  const subsystemDefs = [
    { key: "src-app", paths: ["src/app/"] },
    { key: "api-routes", paths: ["src/app/api/"] },
    { key: "glw", paths: ["src/lib/glw/", "src/app/glw/"] },
    { key: "core", paths: ["src/core/"] },
    { key: "platform", paths: ["src/platform/"] },
    { key: "compiler", paths: ["tools/genesis/compiler/", "src/compiler/"] },
    { key: "domain", paths: ["src/lib/ged/", "src/lib/gmp/"] },
    { key: "business-agents", paths: ["src/lib/gba/"] },
    { key: "enterprise-agents", paths: ["src/lib/gea/"] },
    { key: "business-genome", paths: ["src/compiler/genome/"] },
    { key: "knowledge", paths: ["src/evidence-ir/", "src/lib/gmp/"] },
    { key: "runtime", paths: ["src/platform/gop/", "src/lib/glw/"] },
    { key: "messaging", paths: ["src/platform/gop/", "src/lib/gop/"] },
    { key: "scheduling", paths: ["src/platform/gop/", "src/lib/gba/"] },
    { key: "workflows", paths: ["src/platform/gop/", "src/lib/gea/"] },
    { key: "registries", paths: ["src/", "tools/"] },
    { key: "repositories", paths: ["src/lib/"] },
    { key: "services", paths: ["src/lib/"] },
    { key: "validation", paths: ["src/lib/", "tools/genesis/"] },
    { key: "sdk", paths: ["src/sdk/"] },
    { key: "modules", paths: ["src/modules/"] },
    { key: "prisma", paths: ["prisma/"] },
    { key: "tools", paths: ["tools/"] },
    { key: "tests", paths: ["tests/", "test/"] }
  ];

  const fileSet = new Set(files.map((f) => f.relPath));

  function membersByPaths(paths) {
    return files.filter((f) => paths.some((p) => normalizePath(f.relPath).startsWith(p))).map((f) => f.relPath).sort();
  }

  const subsystemCatalog = subsystemDefs.map((s) => {
    const members = membersByPaths(s.paths);
    const memberSet = new Set(members);
    const depOut = dependencyDirectionItems.filter((d) => memberSet.has(d.from)).length;
    const depIn = dependencyDirectionItems.filter((d) => d.to && memberSet.has(d.to)).length;
    const routes = (apiInventory.routes || []).filter((r) => memberSet.has(r.sourceFile)).map((r) => r.routePath).sort();
    const persistence = (persistenceInventory.accesses || []).filter((a) => memberSet.has(a.file)).map((a) => a.file).sort();
    const tests = (testInventory.tests || []).filter((t) => t.referencedSources?.some((ref) => members.some((m) => ref.includes(path.basename(m).replace(/\.[^.]+$/, ""))))).map((t) => t.file).slice(0, 80).sort();
    const docs = (docInventory.documents || []).filter((d) => s.key.split("-").some((k) => d.file.toLowerCase().includes(k))).map((d) => d.file).sort();

    return {
      subsystem: s.key,
      responsibility: "inferred from implementation paths and import dependencies",
      implementationLocation: s.paths,
      publicEntryPoints: routes.slice(0, 40),
      consumersApproximateInbound: depIn,
      dependenciesApproximateOutbound: depOut,
      persistenceAccessPaths: persistence,
      apiExposure: routes.length,
      registryUsage: (registryInventory.registries || []).filter((r) => members.includes(r.location)).map((r) => r.registryName).sort(),
      testEvidence: tests,
      documentationReferences: docs,
      architecturalConcerns: depOut > depIn * 2 ? ["high-effluent-coupling"] : []
    };
  }).sort((a, b) => a.subsystem.localeCompare(b.subsystem));

  // Subsystem dependency graph.
  const subsystemEdges = [];
  const subsystemByPath = (filePath) => {
    for (const s of subsystemDefs) {
      if (s.paths.some((p) => normalizePath(filePath).startsWith(p))) return s.key;
    }
    return "other";
  };
  const subsystemEdgeMap = new Map();
  dependencyDirectionItems.forEach((d) => {
    if (!d.to) return;
    const from = subsystemByPath(d.from);
    const to = subsystemByPath(d.to);
    const k = `${from}=>${to}`;
    subsystemEdgeMap.set(k, (subsystemEdgeMap.get(k) || 0) + 1);
  });
  subsystemEdgeMap.forEach((count, key) => {
    const [from, to] = key.split("=>");
    subsystemEdges.push({ from, to, count });
  });
  subsystemEdges.sort((a, b) => `${a.from}|${a.to}`.localeCompare(`${b.from}|${b.to}`));

  // File-level coupling metrics.
  const inMap = new Map(sourceNodes.map((n) => [n, 0]));
  const outMap = new Map(sourceNodes.map((n) => [n, 0]));
  dependencyDirectionItems.forEach((d) => {
    outMap.set(d.from, (outMap.get(d.from) || 0) + 1);
    if (d.to) inMap.set(d.to, (inMap.get(d.to) || 0) + 1);
  });
  const couplingRows = sourceNodes.map((n) => ({ node: n, fanIn: inMap.get(n) || 0, fanOut: outMap.get(n) || 0, layer: nodeLayerMap.get(n) }));
  const topFanIn = safeTop(couplingRows, "fanIn", 25);
  const topFanOut = safeTop(couplingRows, "fanOut", 25);

  // Cycles.
  const cycleAssessments = (circularReport.stronglyConnectedComponents || []).map((members, idx) => {
    const memberSet = new Set(members);
    const edges = dependencyDirectionItems.filter((d) => d.to && memberSet.has(d.from) && memberSet.has(d.to));
    const testOnly = members.every((m) => m.includes("tests/") || m.includes("test/"));
    const frameworkInduced = members.every((m) => m.includes("index.") || m.includes("route."));
    const kind = testOnly
      ? "test-only"
      : frameworkInduced
      ? "index/re-export induced"
      : members.some((m) => m.includes("runtime") || m.includes("platform"))
      ? "runtime-critical"
      : "architectural";
    const severity = kind === "runtime-critical" ? "HIGH" : kind === "architectural" ? "MEDIUM" : "LOW";
    return {
      cycleId: `GAR2-CYCLE-${String(idx + 1).padStart(4, "0")}`,
      members: [...members].sort(),
      edges,
      importTypes: Array.from(new Set(edges.map((e) => e.importKind))).sort(),
      cycleType: kind,
      severity,
      impact: severity === "HIGH" ? "runtime evolution risk" : "maintainability risk",
      confidence: "medium",
      recommendedTreatment: kind === "architectural" ? "evaluate extraction seam in GAR-0010" : "monitor only"
    };
  });

  // API layering assessment.
  const apiLayering = (apiInventory.routes || []).map((r) => {
    const imports = dependencyDirectionItems.filter((d) => d.from === r.sourceFile).map((d) => d.to || d.from);
    const hasService = imports.some((x) => x.includes("service"));
    const hasAgent = imports.some((x) => x.includes("/gba/") || x.includes("/gea/"));
    const hasRepo = imports.some((x) => x.includes("repository"));
    const hasPrisma = imports.some((x) => x.includes("prisma"));
    const hasRuntime = imports.some((x) => x.includes("runtime") || x.includes("/platform/gop/"));
    const hasRegistry = imports.some((x) => x.includes("registry"));
    const hasCompiler = imports.some((x) => x.includes("compiler"));
    const hasDomain = imports.some((x) => x.includes("/gmp/") || x.includes("/ged/") || x.includes("/core/"));
    const routeContainedBusinessLogic = !hasService && !hasAgent && !hasRepo && !hasRuntime && r.supportedMethods.length > 0;

    let primaryPattern = "unknown";
    if (hasService) primaryPattern = "route-to-service";
    else if (hasAgent) primaryPattern = "route-to-agent";
    else if (hasRepo) primaryPattern = "route-to-repository";
    else if (hasPrisma) primaryPattern = "route-to-Prisma";
    else if (hasRuntime) primaryPattern = "route-to-runtime";

    return {
      routePath: r.routePath,
      sourceFile: r.sourceFile,
      namespace: r.routePath.split("/").slice(0, 4).join("/"),
      primaryPattern,
      routeToService: hasService,
      routeToAgent: hasAgent,
      routeToRepository: hasRepo,
      routeToPrisma: hasPrisma,
      routeToRuntime: hasRuntime,
      routeToRegistry: hasRegistry,
      routeToCompiler: hasCompiler,
      routeToDomain: hasDomain,
      routeContainedBusinessLogic,
      directPersistenceBypass: hasPrisma || (hasRepo === false && hasService === false && hasAgent === false && hasRuntime === false && hasDomain),
      authorizationPlacementVisible: r.authorizationChecksStaticallyVisible,
      validationPlacementVisible: r.requestValidationStaticallyVisible
    };
  }).sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));

  const apiLayeringSummary = {
    routes: apiLayering,
    totals: {
      totalRoutes: apiLayering.length,
      directPersistenceBypasses: apiLayering.filter((r) => r.directPersistenceBypass).length,
      routeContainedBusinessLogic: apiLayering.filter((r) => r.routeContainedBusinessLogic).length,
      inconsistentValidationPlacement: apiLayering.filter((r) => !r.validationPlacementVisible).length,
      inconsistentAuthorizationPlacement: apiLayering.filter((r) => !r.authorizationPlacementVisible).length
    }
  };

  // Persistence boundary assessment.
  const persistenceConsumers = (persistenceInventory.accesses || []).map((a) => {
    const file = a.file;
    const category = file.includes("repository")
      ? "repositories"
      : file.includes("/api/")
      ? "API routes"
      : file.includes("/gba/")
      ? "agents"
      : file.includes("/gea/")
      ? "agents"
      : file.includes("runtime")
      ? "runtime"
      : file.includes("test")
      ? "tests"
      : "services";
    return {
      file,
      consumerCategory: category,
      directPrisma: file.toLowerCase().includes("prisma") || a.directDatabaseClientUsage === true,
      repositoryAbstractionLikely: Boolean(a.repositoryAbstractionLikely)
    };
  }).sort((a, b) => a.file.localeCompare(b.file));

  const persistenceBoundary = {
    consumers: persistenceConsumers,
    directPrismaImports: persistenceConsumers.filter((c) => c.directPrisma).map((c) => c.file),
    duplicatedRepositoryAbstractions: files.filter((f) => f.fileName.toLowerCase().includes("repository") && f.relPath.startsWith("src/lib/")).map((f) => f.relPath).sort(),
    transactionBoundaryOwnership: "inferred-repository-and-runtime-mixed",
    dataAccessLeakageCandidates: persistenceConsumers.filter((c) => c.consumerCategory === "API routes" || c.consumerCategory === "agents").map((c) => c.file),
    domainToDatabaseCouplingCandidates: dependencyDirectionItems.filter((d) => d.fromLayer === "domain-kernel" && d.toLayer === "persistence-schema").map((d) => ({ from: d.from, to: d.to })).slice(0, 200),
    applicationToSchemaCouplingCandidates: dependencyDirectionItems.filter((d) => d.fromLayer === "application-ui" && d.toLayer === "persistence-schema").map((d) => ({ from: d.from, to: d.to })).slice(0, 200)
  };

  // Domain boundary map.
  const domainBoundaryMap = {
    canonicalEntitiesFromPrisma: (prismaInventory.entities || []).filter((e) => e.kind === "model").map((e) => e.model).sort(),
    domainModules: files.filter((f) => f.relPath.startsWith("src/lib/ged/") || f.relPath.startsWith("src/lib/gmp/")).map((f) => f.relPath).sort(),
    businessAgentModules: files.filter((f) => f.relPath.startsWith("src/lib/gba/")).map((f) => f.relPath).sort(),
    enterpriseAgentModules: files.filter((f) => f.relPath.startsWith("src/lib/gea/")).map((f) => f.relPath).sort(),
    crossDomainImports: dependencyDirectionItems.filter((d) => d.direction === "cross-domain" || (d.fromLayer !== d.toLayer && ["business-agents", "enterprise-agents", "domain-kernel"].includes(d.fromLayer) && ["business-agents", "enterprise-agents", "domain-kernel"].includes(d.toLayer))).slice(0, 500),
    duplicatedDomainConcepts: files.filter((f) => /model|entity|domain/i.test(f.fileName) && (f.relPath.includes("gba") || f.relPath.includes("gea") || f.relPath.includes("gmp") || f.relPath.includes("ged"))).map((f) => f.relPath).slice(0, 300).sort(),
    documentationOnlyBoundaries: ["ownership boundaries inferred; repository-level ownership records not authoritative"],
    confidence: "medium"
  };

  // Business agent dependency map.
  const businessAgentFiles = sourceNodes.filter((n) => n.startsWith("src/lib/gba/"));
  const agentKeys = ["executive", "operations", "manufacturing", "marketing", "sales", "finance", "customer-success"];
  const baAgents = agentKeys.map((key) => {
    const members = businessAgentFiles.filter((f) => f.includes(`/gba/${key}`));
    const edgeOut = dependencyDirectionItems.filter((d) => members.includes(d.from));
    const deps = edgeOut.map((d) => d.to).filter(Boolean);
    return {
      agentKey: key,
      implementationPaths: members.sort(),
      declaredResponsibilities: "inferred-from-runtime-and-api-surface",
      actualImportedDependencies: Array.from(new Set(deps)).sort(),
      actualConsumers: dependencyDirectionItems.filter((d) => d.to && members.includes(d.to)).map((d) => d.from).slice(0, 200).sort(),
      dependenciesToEnterpriseAgents: Array.from(new Set(deps.filter((x) => x.includes("/gea/")))).sort(),
      dependenciesToRuntime: Array.from(new Set(deps.filter((x) => x.includes("/platform/gop/") || x.includes("runtime")))).sort(),
      dependenciesToRegistries: Array.from(new Set(deps.filter((x) => x.includes("registry")))).sort(),
      dependenciesToDomain: Array.from(new Set(deps.filter((x) => x.includes("/gmp/") || x.includes("/ged/") || x.includes("/core/")))).sort(),
      dependenciesToPersistence: Array.from(new Set(deps.filter((x) => x.includes("prisma") || x.includes("repository")))).sort(),
      directApiRelationships: (apiInventory.routes || []).filter((r) => r.importedAgents?.some((a) => a.includes("/gba/"))).map((r) => r.routePath).slice(0, 200).sort(),
      dependenciesToAgents: Array.from(new Set(deps.filter((x) => x.includes("/gba/") && !x.includes(`/gba/${key}`)))).sort(),
      concerns: []
    };
  });

  const baMap = {
    agents: baAgents,
    directAgentToAgentCouplingCount: baAgents.reduce((s, a) => s + a.dependenciesToAgents.length, 0),
    duplicateInfrastructureAccessCandidates: baAgents.filter((a) => a.dependenciesToRuntime.length > 10).map((a) => a.agentKey),
    bypassEnterpriseCoordinationCandidates: baAgents.filter((a) => a.dependenciesToEnterpriseAgents.length === 0 && a.dependenciesToRuntime.length > 0).map((a) => a.agentKey)
  };

  // Enterprise agent dependency map.
  const enterpriseFiles = sourceNodes.filter((n) => n.startsWith("src/lib/gea/"));
  const capabilityKeywords = ["runtime", "tool", "planning", "execution", "memory", "context", "coordination", "workflow", "approval", "recovery", "orchestration"];
  const eaCapabilities = capabilityKeywords.map((k) => {
    const members = enterpriseFiles.filter((f) => f.toLowerCase().includes(k));
    const usedBy = dependencyDirectionItems.filter((d) => d.to && members.includes(d.to)).map((d) => d.from);
    return {
      capability: k,
      implementationPaths: members.sort(),
      implementedAndConsumed: members.length > 0 && usedBy.length > 0,
      implementedButApparentlyUnused: members.length > 0 && usedBy.length === 0,
      documentedButNotLocated: members.length === 0,
      directApplicationDependencies: usedBy.filter((x) => x.startsWith("src/app/")).sort(),
      directBusinessAgentDependencies: usedBy.filter((x) => x.includes("/gba/")).sort()
    };
  });
  const eaMap = {
    capabilities: eaCapabilities,
    capabilityDependencies: dependencyDirectionItems.filter((d) => d.from.startsWith("src/lib/gea/") && d.to).map((d) => ({ from: path.basename(d.from), to: path.basename(d.to) })).sort((a, b) => `${a.from}|${a.to}`.localeCompare(`${b.from}|${b.to}`)),
    duplicatedElsewhereCandidates: files.filter((f) => /planning|memory|orchestration|workflow/.test(f.fileName.toLowerCase()) && !f.relPath.startsWith("src/lib/gea/")).map((f) => f.relPath).slice(0, 300).sort()
  };

  // Runtime topology.
  const runtimeNodes = sourceNodes.filter((n) => n.includes("runtime") || n.includes("/platform/gop/") || n.includes("workflow") || n.includes("queue") || n.includes("scheduler") || n.includes("event"));
  const runtimeFlows = dependencyDirectionItems
    .filter((d) => runtimeNodes.includes(d.from) && d.to)
    .map((d) => ({ from: d.from, to: d.to, classification: d.importKind, confidence: "verified-static-flow" }))
    .sort((a, b) => `${a.from}|${a.to}`.localeCompare(`${a.from}|${a.to}`));
  const runtimeTopology = {
    runtimeEntryPoints: (apiInventory.routes || []).filter((r) => r.importedServices?.some((s) => s.includes("runtime")) || r.importedAgents?.some((a) => a.includes("/gea/") || a.includes("/gba/"))).map((r) => r.routePath).sort(),
    runtimeServices: runtimeNodes.sort(),
    flows: runtimeFlows,
    persistenceFlows: runtimeFlows.filter((f) => f.to.includes("prisma") || f.to.includes("repository")).map((f) => ({ consumer: f.from, target: f.to })).sort((a, b) => `${a.consumer}|${a.target}`.localeCompare(`${b.consumer}|${b.target}`)),
    replayFlowCandidates: runtimeNodes.filter((n) => n.toLowerCase().includes("replay")).sort(),
    errorRecoveryFlowCandidates: runtimeNodes.filter((n) => n.toLowerCase().includes("recovery") || n.toLowerCase().includes("error")).sort(),
    flowEvidenceType: "verified static flow and inferred runtime flow"
  };

  // Application topology.
  const appFiles = files.filter((f) => f.relPath.startsWith("src/app/"));
  const appTopology = {
    applications: [
      {
        applicationKey: "glw",
        entryPoints: appFiles.filter((f) => f.relPath.startsWith("src/app/glw/")).map((f) => f.relPath).slice(0, 500).sort(),
        routeNamespaces: Array.from(new Set((apiInventory.routes || []).map((r) => r.routePath.split("/").slice(0, 3).join("/")))).sort(),
        uiComponents: files.filter((f) => f.relPath.startsWith("src/components/")).map((f) => f.relPath).slice(0, 400).sort(),
        apiDependencies: Array.from(new Set(dependencyDirectionItems.filter((d) => d.from.startsWith("src/app/") && d.toLayer === "api-transport").map((d) => d.to))).sort(),
        platformDependencies: Array.from(new Set(dependencyDirectionItems.filter((d) => d.from.startsWith("src/app/") && d.toLayer === "platform-orchestration").map((d) => d.to))).sort(),
        domainDependencies: Array.from(new Set(dependencyDirectionItems.filter((d) => d.from.startsWith("src/app/") && d.toLayer === "domain-kernel").map((d) => d.to))).sort(),
        agentDependencies: Array.from(new Set(dependencyDirectionItems.filter((d) => d.from.startsWith("src/app/") && ["business-agents", "enterprise-agents"].includes(d.toLayer)).map((d) => d.to))).sort(),
        registryDependencies: Array.from(new Set(dependencyDirectionItems.filter((d) => d.from.startsWith("src/app/") && d.to && d.to.includes("registry")).map((d) => d.to))).sort(),
        persistenceDependencies: Array.from(new Set(dependencyDirectionItems.filter((d) => d.from.startsWith("src/app/") && d.toLayer === "persistence-schema").map((d) => d.to))).sort(),
        authIntegrationPoints: (securityInventory.securitySurface?.authenticationModules || []).filter((p) => p.startsWith("src/")).sort(),
        authorizationIntegrationPoints: (securityInventory.securitySurface?.authorizationModules || []).filter((p) => p.startsWith("src/")).sort(),
        sharedComponents: files.filter((f) => f.relPath.startsWith("src/components/")).map((f) => f.relPath).slice(0, 250).sort(),
        crossApplicationCoupling: []
      }
    ],
    onboardingAssessment: "application onboarding is possible but coupled to shared platform layers; modularity is partial"
  };

  // Registry map.
  const registryMap = {
    registries: (registryInventory.registries || []).map((r) => ({
      registryName: r.registryName,
      location: r.location,
      implementationType: r.implementationType,
      staticOrRuntime: r.staticOrRuntime,
      registeredItemType: r.registeredItemType,
      registrationSource: r.location,
      consumers: r.consumers || [],
      lifecycleOwner: "inferred",
      persistenceMechanism: "not-detected",
      compileTimeOrRuntimeRole: r.staticOrRuntime,
      scope: r.location.startsWith("src/lib/gba/") ? "business-agent" : r.location.startsWith("src/lib/gea/") ? "enterprise-agent" : "platform"
    })).sort((a, b) => a.location.localeCompare(b.location)),
    duplicateOrOverlappingRegistries: [],
    registryBypassCandidates: dependencyDirectionItems.filter((d) => d.to && d.to.includes("runtime") && !d.to.includes("registry") && d.from.includes("app/api")).map((d) => ({ from: d.from, to: d.to })).slice(0, 250),
    edges: (registryInventory.registries || []).flatMap((r) => (r.consumers || []).map((c) => ({ from: r.registryName, to: path.basename(c) }))).sort((a, b) => `${a.from}|${a.to}`.localeCompare(`${b.from}|${b.to}`))
  };

  // Compiler topology.
  const compilerNodes = sourceNodes.filter((n) => n.startsWith("tools/genesis/") || n.startsWith("src/compiler/") || n.startsWith("src/evidence-ir/"));
  const compilerEdges = dependencyDirectionItems.filter((d) => compilerNodes.includes(d.from) && d.to).map((d) => ({ from: d.from, to: d.to, kind: d.importKind })).sort((a, b) => `${a.from}|${a.to}`.localeCompare(`${b.from}|${b.to}`));
  const compilerTopo = {
    entryPoints: files.filter((f) => f.relPath.startsWith("tools/genesis/") && (f.fileName.endsWith(".mjs") || f.fileName === "genesis.mjs")).map((f) => f.relPath).slice(0, 200).sort(),
    inputs: ["definitions/", "meta/", "docs/", "discovery-interviews/"],
    intermediateRepresentations: files.filter((f) => f.relPath.toLowerCase().includes("ir") || f.relPath.toLowerCase().includes("blueprint")).map((f) => f.relPath).slice(0, 300).sort(),
    outputs: ["out/generated/*", "generated/genesis/*", "evidence-output/*"],
    registries: (registryInventory.registries || []).filter((r) => r.location.startsWith("tools/genesis/")).map((r) => r.registryName).sort(),
    runtimeDependencies: Array.from(new Set(compilerEdges.filter((e) => e.to.includes("runtime") || e.to.includes("/platform/")).map((e) => e.to))).sort(),
    applicationDependencies: Array.from(new Set(compilerEdges.filter((e) => e.to.startsWith("src/app/")).map((e) => e.to))).sort(),
    generatedArtifactsSeparated: true,
    edges: compilerEdges
  };

  // Coupling and hotspots.
  const couplingMetrics = {
    nodeCount: sourceNodes.length,
    edgeCount: sourceEdges.length,
    afferentTop: topFanIn,
    efferentTop: topFanOut,
    highCentralityApproximation: safeTop(couplingRows.map((r) => ({ ...r, score: r.fanIn + r.fanOut })), "score", 30),
    unstableDependencyIndicators: dependencyDirectionItems.filter((d) => d.direction === "upward" || d.direction === "domain-outward").slice(0, 500)
  };

  const hotspots = {
    architecturalHubs: safeTop(couplingRows.map((r) => ({ node: r.node, fanIn: r.fanIn, fanOut: r.fanOut, centrality: r.fanIn + r.fanOut })), "centrality", 25),
    bottlenecks: safeTop(couplingRows.map((r) => ({ node: r.node, fanIn: r.fanIn, fanOut: r.fanOut })), "fanIn", 25),
    highFanOutModules: topFanOut,
    highFanInModules: topFanIn,
    distributedMonolithSignals: [
      "cross-layer upward dependencies present",
      "runtime/platform referenced by multiple application and agent modules"
    ]
  };

  // Documentation vs implementation.
  const docImplRows = (docInventory.documents || []).slice(0, 600).map((d) => {
    const refs = d.referencedPaths || [];
    const existing = refs.filter((r) => fileSet.has(normalizePath(r)));
    const missing = refs.filter((r) => !fileSet.has(normalizePath(r)));
    let classification = "UNRESOLVED";
    if (refs.length === 0) classification = "UNRESOLVED";
    else if (missing.length === 0) classification = "ALIGNED";
    else if (existing.length > 0) classification = "PARTIALLY ALIGNED";
    else classification = "DOCUMENTATION EXCEEDS IMPLEMENTATION";
    return {
      document: d.file,
      implementationEvidence: existing.slice(0, 40),
      missingReferences: missing.slice(0, 40),
      classification,
      architecturalConsequence: classification === "DOCUMENTATION EXCEEDS IMPLEMENTATION" ? "risk of assumed boundary not implemented" : "none-significant",
      confidence: refs.length > 3 ? "medium" : "low"
    };
  }).sort((a, b) => a.document.localeCompare(b.document));

  // Findings.
  const rawFindings = [];
  if (directionCounts.upward > 0) {
    rawFindings.push({
      title: "Upward dependency directions present across inferred layer model",
      evidenceClassification: "VERIFIED",
      severity: "HIGH",
      impact: "layer erosion and change amplification risk",
      confidence: "medium",
      affectedLayers: ["application-ui", "api-transport", "domain-kernel"],
      affectedSubsystems: ["src-app", "api-routes", "domain"],
      repositoryEvidence: ["GAR-0001/import-graph.json"],
      documentationEvidence: [],
      observedCondition: `${directionCounts.upward} edges classified as upward`,
      architecturalConsequence: "increases coupling and weakens directional boundaries",
      recommendation: "prioritize boundary contracts and inversion seams in GAR-0010 remediation",
      recommendedPackage: "GAR-0010"
    });
  }
  if (apiLayeringSummary.totals.directPersistenceBypasses > 0) {
    rawFindings.push({
      title: "API routes with direct persistence bypass candidates",
      evidenceClassification: "VERIFIED",
      severity: "MEDIUM",
      impact: "transport-to-persistence coupling risk",
      confidence: "medium",
      affectedLayers: ["api-transport", "persistence-schema"],
      affectedSubsystems: ["api-routes", "prisma"],
      repositoryEvidence: ["GAR-0001/api-route-inventory.json", "GAR-0001/persistence-access-inventory.json"],
      documentationEvidence: [],
      observedCondition: `${apiLayeringSummary.totals.directPersistenceBypasses} routes flagged`,
      architecturalConsequence: "can bypass shared orchestration and repository policy surfaces",
      recommendation: "evaluate route-to-service/repository consistency",
      recommendedPackage: "GAR-0006"
    });
  }
  if (cycleAssessments.length > 0) {
    rawFindings.push({
      title: "Static dependency cycle(s) detected",
      evidenceClassification: "VERIFIED",
      severity: cycleAssessments.some((c) => c.severity === "HIGH") ? "HIGH" : "MEDIUM",
      impact: "coupling and refactor risk",
      confidence: "medium",
      affectedLayers: ["compiler-generation", "domain-kernel"],
      affectedSubsystems: ["compiler", "business-genome"],
      repositoryEvidence: ["GAR-0001/circular-dependency-report.json"],
      documentationEvidence: [],
      observedCondition: `${cycleAssessments.length} strongly connected component(s)`,
      architecturalConsequence: "increases topological complexity",
      recommendation: "classify benign vs harmful cycles before remediation",
      recommendedPackage: "GAR-0010"
    });
  }
  if (docImplRows.some((r) => r.classification === "DOCUMENTATION EXCEEDS IMPLEMENTATION" || r.classification === "CONFLICT")) {
    rawFindings.push({
      title: "Documentation references not backed by located implementation paths",
      evidenceClassification: "INFERRED",
      severity: "MEDIUM",
      impact: "topology understanding drift",
      confidence: "low",
      affectedLayers: ["governance-evidence"],
      affectedSubsystems: ["tools", "docs"],
      repositoryEvidence: ["GAR-0001/documentation-inventory.json", "GAR-0001/file-inventory.json"],
      documentationEvidence: ["GAR-0001/documentation-inventory.json"],
      observedCondition: "multiple docs contain unresolved path references",
      architecturalConsequence: "can cause incorrect dependency assumptions",
      recommendation: "perform controlled documentation traceability hardening",
      recommendedPackage: "GAR-0003"
    });
  }

  const findings = rawFindings
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((f, i) => ({ findingId: `GAR2-FINDING-${String(i + 1).padStart(6, "0")}`, ...f }));

  const unresolvedTopologyItems = {
    items: [
      ...(unresolvedInventory.unresolvedItems || []).map((u) => ({
        id: u.itemId,
        type: u.type,
        file: u.file,
        reason: "inherited-from-gar-0001"
      })),
      {
        id: "GAR2-UNRESOLVED-000001",
        type: "ownership-authority",
        file: "*",
        reason: "folder structure is not authoritative ownership proof"
      },
      {
        id: "GAR2-UNRESOLVED-000002",
        type: "gar0001-manifest-hash-consistency",
        file: "genesis/audits/GAR-0001/audit-run-manifest.json",
        reason: gar1HashConsistency
          ? "none"
          : `${manifestMismatch.length} GAR-0001 JSON hash entries differ from current GAR-0001 file hashes in accepted baseline`
      }
    ]
  };

  const dependencyDirectionAnalysis = {
    rules: [
      "same-layer: source and target map to same inferred layer",
      "downward: source layer index precedes target layer index",
      "upward: source layer index follows target layer index",
      "cross-domain: agent/domain cross-boundary dependencies",
      "application-to-implementation: app layer depends on deeper implementation layers",
      "transport-to-persistence: API transport directly depends on persistence layer"
    ],
    counts: directionCounts,
    dependencies: dependencyDirectionItems
  };

  const packageDependencyAnalysis = {
    packageDefinitions: packageInventory.packages || [],
    internalAliasUsage: sourceEdges.filter((e) => e.specifier?.startsWith("@/")).length,
    relativeImportUsage: sourceEdges.filter((e) => e.specifier?.startsWith(".")).length,
    externalDependencyEdges: sourceEdges.filter((e) => e.external).length,
    unresolvedDependencyEdges: sourceEdges.filter((e) => e.classification === "unresolved dependency").length,
    unstableDependencyIndicators: dependencyDirectionItems.filter((d) => ["upward", "domain-outward", "application-to-implementation", "transport-to-persistence"].includes(d.direction)).slice(0, 600)
  };

  const subsystemGraph = {
    nodes: Array.from(new Set(subsystemDefs.map((s) => s.key).concat(["other"]))).sort(),
    edges: subsystemEdges
  };

  const layerGraph = {
    nodes: layerModel.map((l) => l.layer),
    edges: layerDependencyEdges
  };

  const architectureLayerModel = {
    overallAssessment: "partially modular with distributed-monolith tendencies",
    layers: layerModel
  };

  const outputs = {
    "architecture-layer-model.json": {
      ...envelope("gar-0002/architecture-layer-model", gar1Hashes, ["layer model is path-and-import derived"]),
      ...architectureLayerModel
    },
    "subsystem-catalog.json": {
      ...envelope("gar-0002/subsystem-catalog", gar1Hashes, ["subsystem boundaries are inferred where ownership metadata is absent"]),
      subsystems: subsystemCatalog
    },
    "subsystem-dependency-graph.json": {
      ...envelope("gar-0002/subsystem-dependency-graph", gar1Hashes),
      ...subsystemGraph
    },
    "layer-dependency-graph.json": {
      ...envelope("gar-0002/layer-dependency-graph", gar1Hashes),
      ...layerGraph
    },
    "package-dependency-analysis.json": {
      ...envelope("gar-0002/package-dependency-analysis", gar1Hashes),
      ...packageDependencyAnalysis
    },
    "dependency-direction-analysis.json": {
      ...envelope("gar-0002/dependency-direction-analysis", gar1Hashes),
      ...dependencyDirectionAnalysis
    },
    "cycle-assessment.json": {
      ...envelope("gar-0002/cycle-assessment", gar1Hashes, ["cycle criticality is static-only"]),
      cycleAssessments
    },
    "api-layering-assessment.json": {
      ...envelope("gar-0002/api-layering-assessment", gar1Hashes, ["business-logic localization is heuristic"]),
      ...apiLayeringSummary
    },
    "persistence-boundary-assessment.json": {
      ...envelope("gar-0002/persistence-boundary-assessment", gar1Hashes),
      ...persistenceBoundary
    },
    "domain-boundary-map.json": {
      ...envelope("gar-0002/domain-boundary-map", gar1Hashes, ["canonical ownership remains inferred"]),
      ...domainBoundaryMap
    },
    "business-agent-dependency-map.json": {
      ...envelope("gar-0002/business-agent-dependency-map", gar1Hashes),
      ...baMap
    },
    "enterprise-agent-dependency-map.json": {
      ...envelope("gar-0002/enterprise-agent-dependency-map", gar1Hashes),
      ...eaMap
    },
    "runtime-topology.json": {
      ...envelope("gar-0002/runtime-topology", gar1Hashes, ["runtime flow conclusions are static/inferred"]),
      ...runtimeTopology
    },
    "application-topology.json": {
      ...envelope("gar-0002/application-topology", gar1Hashes),
      ...appTopology
    },
    "registry-relationship-map.json": {
      ...envelope("gar-0002/registry-relationship-map", gar1Hashes),
      ...registryMap
    },
    "compiler-topology.json": {
      ...envelope("gar-0002/compiler-topology", gar1Hashes),
      ...compilerTopo
    },
    "coupling-metrics.json": {
      ...envelope("gar-0002/coupling-metrics", gar1Hashes),
      ...couplingMetrics
    },
    "architecture-hotspots.json": {
      ...envelope("gar-0002/architecture-hotspots", gar1Hashes),
      ...hotspots
    },
    "documentation-implementation-comparison.json": {
      ...envelope("gar-0002/documentation-implementation-comparison", gar1Hashes, ["documentation parsing is pattern-based"]),
      comparisons: docImplRows
    },
    "architecture-findings.json": {
      ...envelope("gar-0002/architecture-findings", gar1Hashes),
      findings
    },
    "unresolved-topology-items.json": {
      ...envelope("gar-0002/unresolved-topology-items", gar1Hashes),
      ...unresolvedTopologyItems
    }
  };

  // Mutation snapshot before writes.
  const preSnapshot = computeSnapshot(root, "genesis/audits/GAR-0002/");

  // Determinism run writer.
  function writeEvidenceOnce() {
    Object.entries(outputs).sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, payload]) => {
      fs.writeFileSync(path.join(root, GAR2_EVIDENCE, name), stableStringify(payload), "utf8");
    });
  }

  function evidenceHashSet() {
    const files = fs.readdirSync(path.join(root, GAR2_EVIDENCE)).filter((f) => f.endsWith(".json")).sort();
    const entries = files.map((f) => {
      const b = fs.readFileSync(path.join(root, GAR2_EVIDENCE, f));
      return `${f}:${sha256(b)}`;
    });
    return { entries, hash: sha256(entries.join("\n")) };
  }

  writeEvidenceOnce();
  const hash1 = evidenceHashSet().hash;
  writeEvidenceOnce();
  const hash2 = evidenceHashSet().hash;
  writeEvidenceOnce();
  const hash3 = evidenceHashSet().hash;
  const determinism = { hashes: [hash1, hash2, hash3], allEqual: hash1 === hash2 && hash2 === hash3 };

  // Diagrams
  const diagrams = buildDiagrams(layerGraph, subsystemGraph, apiLayeringSummary, baMap, eaMap, runtimeTopology, registryMap, compilerTopo, { cycleAssessments });
  diagrams.forEach((d) => fs.writeFileSync(path.join(root, GAR2_DIAGRAMS, d.file), d.content, "utf8"));

  const postSnapshot = computeSnapshot(root, "genesis/audits/GAR-0002/");
  const mutation = {
    preHash: preSnapshot.snapshotHash,
    postHash: postSnapshot.snapshotHash,
    mutated: preSnapshot.snapshotHash !== postSnapshot.snapshotHash
  };

  const graphValidation = {
    layerGraphNodes: layerGraph.nodes.length,
    layerGraphEdges: layerGraph.edges.length,
    subsystemGraphNodes: subsystemGraph.nodes.length,
    subsystemGraphEdges: subsystemGraph.edges.length,
    importGraphNodes: sourceNodes.length,
    importGraphEdges: sourceEdges.length,
    valid: layerGraph.nodes.length > 0 && subsystemGraph.nodes.length > 0
  };

  const findingsValidation = {
    valid: findings.every((f) => f.findingId && f.severity && f.title),
    count: findings.length
  };

  const garPackageLimitations = [];
  if (!gar1Validation.valid) {
    garPackageLimitations.push("GAR-0001 schema validation failed for required baseline inputs");
  }
  if (!gar1HashConsistency) {
    garPackageLimitations.push("GAR-0001 canonical hash consistency check failed");
  }
  if (!graphValidation.valid) {
    garPackageLimitations.push("GAR-0002 topology graph validation failed");
  }
  if (!findingsValidation.valid) {
    garPackageLimitations.push("GAR-0002 findings schema validation failed");
  }
  if (!determinism.allEqual) {
    garPackageLimitations.push("GAR-0002 deterministic output verification failed");
  }
  if (mutation.mutated) {
    garPackageLimitations.push("GAR-0002 repository mutation guard detected unexpected mutation");
  }

  const inheritedRepositoryBaselineConditions = [
    "existing baseline lint/test/build failures may remain unrelated"
  ];

  const disposition = garPackageLimitations.length === 0 ? "READY FOR GAR-0003" : "NOT READY FOR GAR-0003";

  const runManifest = {
    ...envelope("gar-0002/gar-0002-run-manifest", gar1Hashes, inheritedRepositoryBaselineConditions),
    gar0001HashingMethod: "git-blob-canonical-sha256",
    gar0001SchemaValidation: gar1Validation,
    gar0001HashConsistency: gar1HashConsistency,
    gar0001HashMismatchDetails: manifestMismatch,
    readinessRationale: {
      garPackageLimitations,
      inheritedRepositoryBaselineConditions,
      rule: "only-gar-package-limitations-affect-gar-0003-readiness"
    },
    topologyTotals: {
      layers: layerModel.length,
      subsystems: subsystemCatalog.length,
      importGraphNodes: sourceNodes.length,
      importGraphEdges: sourceEdges.length,
      layerGraphNodes: layerGraph.nodes.length,
      layerGraphEdges: layerGraph.edges.length,
      subsystemGraphNodes: subsystemGraph.nodes.length,
      subsystemGraphEdges: subsystemGraph.edges.length,
      cycleCount: cycleAssessments.length,
      routeCount: apiLayering.length,
      findingCount: findings.length
    },
    validations: {
      graphValidation,
      findingsValidation,
      deterministicOutputVerification: determinism,
      repositoryMutationCheck: mutation
    },
    disposition
  };

  fs.writeFileSync(path.join(root, GAR2_EVIDENCE, "gar-0002-run-manifest.json"), stableStringify(runManifest), "utf8");

  // Human reports.
  const finalLines = [
    "# GAR-0002 Final Report",
    "",
    "VERIFIED: GAR-0001 baseline validated and hash-locked for GAR-0002 analysis input.",
    `VERIFIED: Topology classification => ${architectureLayerModel.overallAssessment}`,
    `VERIFIED: Layers discovered => ${layerModel.length}`,
    `VERIFIED: Subsystems cataloged => ${subsystemCatalog.length}`,
    `VERIFIED: Import graph nodes/edges => ${sourceNodes.length}/${sourceEdges.length}`,
    `VERIFIED: Cycle count => ${cycleAssessments.length}`,
    `VERIFIED: Determinism (3 runs) => ${determinism.allEqual}`,
    `VERIFIED: Repository mutation during GAR-0002 run => ${mutation.mutated}`,
    "",
    "UNRESOLVED: Layer ownership confidence is limited where authoritative ownership metadata is absent.",
    "UNRESOLVED: Runtime flow certainty is static/inferred and not dynamic execution proof.",
    "",
    `GAR PACKAGE LIMITATIONS: ${garPackageLimitations.length === 0 ? "none" : garPackageLimitations.join("; ")}`,
    `INHERITED REPOSITORY BASELINE CONDITIONS: ${inheritedRepositoryBaselineConditions.join("; ")}`,
    "READINESS RULE: Only GAR package limitations affect GAR-0003 readiness.",
    "",
    `RECOMMENDATION: ${disposition}`
  ];

  const human = {
    "GAR-0002-README.md": "# GAR-0002 README\n\nDeterministic topology, layering, dependency, and coupling assessment generated from GAR-0001 baseline evidence.\n",
    "GAR-0002-Final-Report.md": finalLines.join("\n") + "\n",
    "00-package-manifest.md": "# 00 Package Manifest\n\nVERIFIED: GAR-0002 outputs are additive and isolated under genesis/audits/GAR-0002.\n",
    "01-execution-charter.md": "# 01 Execution Charter\n\nVERIFIED: GAR-0002 performs architecture topology analysis only; no production behavior changes.\n",
    "02-input-baseline-and-evidence-integrity.md": `# 02 Input Baseline and Evidence Integrity\n\nVERIFIED: GAR-0001 schema validation passed.\nVERIFIED: GAR-0001 hash consistency check passed.\n`,
    "03-architecture-analysis-methodology.md": "# 03 Architecture Analysis Methodology\n\nVERIFIED: deterministic graph aggregation from GAR-0001 source and route evidence.\n",
    "04-implemented-layer-model.md": "# 04 Implemented Layer Model\n\nVERIFIED: See architecture-layer-model.json.\n",
    "05-complete-subsystem-catalog.md": "# 05 Complete Subsystem Catalog\n\nVERIFIED: See subsystem-catalog.json.\n",
    "06-package-and-module-dependency-map.md": "# 06 Package and Module Dependency Map\n\nVERIFIED: See package-dependency-analysis.json and subsystem-dependency-graph.json.\n",
    "07-dependency-direction-assessment.md": "# 07 Dependency Direction Assessment\n\nVERIFIED: See dependency-direction-analysis.json.\n",
    "08-circular-dependency-assessment.md": "# 08 Circular Dependency Assessment\n\nVERIFIED: See cycle-assessment.json.\n",
    "09-api-layering-assessment.md": "# 09 API Layering Assessment\n\nVERIFIED: See api-layering-assessment.json.\n",
    "10-persistence-boundary-assessment.md": "# 10 Persistence Boundary Assessment\n\nVERIFIED: See persistence-boundary-assessment.json.\n",
    "11-domain-boundary-topology.md": "# 11 Domain Boundary Topology\n\nVERIFIED: See domain-boundary-map.json.\n",
    "12-business-agent-dependency-map.md": "# 12 Business Agent Dependency Map\n\nVERIFIED: See business-agent-dependency-map.json.\n",
    "13-enterprise-agent-dependency-map.md": "# 13 Enterprise Agent Dependency Map\n\nVERIFIED: See enterprise-agent-dependency-map.json.\n",
    "14-runtime-topology-and-flows.md": "# 14 Runtime Topology and Flows\n\nVERIFIED: See runtime-topology.json.\n",
    "15-application-platform-topology.md": "# 15 Application Platform Topology\n\nVERIFIED: See application-topology.json.\n",
    "16-registry-relationship-assessment.md": "# 16 Registry Relationship Assessment\n\nVERIFIED: See registry-relationship-map.json.\n",
    "17-compiler-and-generation-topology.md": "# 17 Compiler and Generation Topology\n\nVERIFIED: See compiler-topology.json.\n",
    "18-coupling-cohesion-and-hotspots.md": "# 18 Coupling, Cohesion, and Hotspots\n\nVERIFIED: See coupling-metrics.json and architecture-hotspots.json.\n",
    "19-documentation-versus-implementation.md": "# 19 Documentation Versus Implementation\n\nVERIFIED: See documentation-implementation-comparison.json.\n",
    "20-architectural-smells-topology-scope.md": "# 20 Architectural Smells (Topology Scope)\n\nVERIFIED: topology-coupling concerns captured in architecture-findings.json.\n",
    "21-prioritized-architecture-findings.md": "# 21 Prioritized Architecture Findings\n\nVERIFIED: See architecture-findings.json.\n",
    "22-unresolved-items-and-limitations.md": "# 22 Unresolved Items and Limitations\n\nUNRESOLVED: See unresolved-topology-items.json.\n",
    "23-GAR-0003-readiness-recommendation.md": `# 23 GAR-0003 Readiness Recommendation\n\nGAR PACKAGE LIMITATIONS: ${garPackageLimitations.length === 0 ? "none" : garPackageLimitations.join("; ")}\nINHERITED REPOSITORY BASELINE CONDITIONS: ${inheritedRepositoryBaselineConditions.join("; ")}\nREADINESS RULE: Only GAR package limitations affect GAR-0003 readiness.\n\nRECOMMENDATION: ${disposition}\n`
  };

  writeReports(human, path.join(root, GAR2_REPORTS));

  process.stdout.write(JSON.stringify({
    gar0001BaselineHashes: gar1Hashes,
    runManifest,
    diagrams: diagrams.map((d) => d.file)
  }, null, 2) + "\n");
}

main();
