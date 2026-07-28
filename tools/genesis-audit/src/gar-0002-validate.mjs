#!/usr/bin/env node
import fs from "fs";
import path from "path";

const base = path.join(process.cwd(), "genesis/audits/GAR-0002/evidence");

const required = {
  "architecture-layer-model.json": ["overallAssessment", "layers"],
  "subsystem-catalog.json": ["subsystems"],
  "subsystem-dependency-graph.json": ["nodes", "edges"],
  "layer-dependency-graph.json": ["nodes", "edges"],
  "package-dependency-analysis.json": ["packageDefinitions"],
  "dependency-direction-analysis.json": ["rules", "counts", "dependencies"],
  "cycle-assessment.json": ["cycleAssessments"],
  "api-layering-assessment.json": ["routes", "totals"],
  "persistence-boundary-assessment.json": ["consumers"],
  "domain-boundary-map.json": ["canonicalEntitiesFromPrisma"],
  "business-agent-dependency-map.json": ["agents"],
  "enterprise-agent-dependency-map.json": ["capabilities"],
  "runtime-topology.json": ["runtimeEntryPoints", "flows"],
  "application-topology.json": ["applications"],
  "registry-relationship-map.json": ["registries"],
  "compiler-topology.json": ["entryPoints", "edges"],
  "coupling-metrics.json": ["nodeCount", "edgeCount", "afferentTop", "efferentTop"],
  "architecture-hotspots.json": ["architecturalHubs", "bottlenecks"],
  "documentation-implementation-comparison.json": ["comparisons"],
  "architecture-findings.json": ["findings"],
  "unresolved-topology-items.json": ["items"],
  "gar-0002-run-manifest.json": ["topologyTotals", "validations", "disposition"]
};

const envelopeKeys = [
  "schemaIdentifier",
  "schemaVersion",
  "toolVersion",
  "gar0001BaselineHashes",
  "evidenceClassification",
  "generationMethod",
  "limitations"
];

const results = Object.entries(required).map(([file, keys]) => {
  const p = path.join(base, file);
  if (!fs.existsSync(p)) {
    return { file, valid: false, missing: ["<file-missing>"] };
  }
  const json = JSON.parse(fs.readFileSync(p, "utf8"));
  const missingEnvelope = envelopeKeys.filter((k) => !(k in json));
  const missingPayload = keys.filter((k) => !(k in json));
  return {
    file,
    valid: missingEnvelope.length === 0 && missingPayload.length === 0,
    missing: [...missingEnvelope, ...missingPayload]
  };
});

const out = {
  valid: results.every((r) => r.valid),
  results,
  findingsSchemaValid: (() => {
    const f = JSON.parse(fs.readFileSync(path.join(base, "architecture-findings.json"), "utf8"));
    return (f.findings || []).every((x) => x.findingId && x.title && x.severity && x.evidenceClassification);
  })()
};

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
if (!out.valid || !out.findingsSchemaValid) process.exit(1);
