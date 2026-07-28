import fs from "fs";
import path from "path";

export function validateSchemaEnvelope(obj) {
  const required = [
    "schemaIdentifier",
    "schemaVersion",
    "scannerVersion",
    "evidenceClassification",
    "generationMethod",
    "limitations"
  ];

  const missing = required.filter((k) => !(k in obj));
  return {
    valid: missing.length === 0,
    missing
  };
}

export function validateOutputs(outputDir) {
  const files = fs.readdirSync(outputDir).filter((f) => f.endsWith(".json")).sort();
  const results = [];
  const expectedTopLevel = {
    "repository-manifest.json": ["totalFiles"],
    "directory-inventory.json": ["directories"],
    "file-inventory.json": ["files"],
    "package-inventory.json": ["packages"],
    "source-symbol-inventory.json": ["symbols"],
    "import-graph.json": ["nodes", "edges"],
    "circular-dependency-report.json": ["stronglyConnectedComponents"],
    "api-route-inventory.json": ["routes"],
    "prisma-inventory.json": ["entities"],
    "persistence-access-inventory.json": ["accesses"],
    "test-inventory.json": ["tests"],
    "documentation-inventory.json": ["documents"],
    "governance-artifact-inventory.json": ["artifacts"],
    "registry-inventory.json": ["registries"],
    "security-surface-inventory.json": ["securitySurface"],
    "hygiene-inventory.json": ["hygiene"],
    "unresolved-analysis-items.json": ["unresolvedItems"],
    "audit-run-manifest.json": ["totals"]
  };

  files.forEach((file) => {
    const parsed = JSON.parse(fs.readFileSync(path.join(outputDir, file), "utf8"));
    const envelopeCheck = validateSchemaEnvelope(parsed);
    const required = expectedTopLevel[file] || [];
    const missingTopLevel = required.filter((key) => !(key in parsed));
    const valid = envelopeCheck.valid && missingTopLevel.length === 0;
    results.push({
      file,
      valid,
      missing: [...envelopeCheck.missing, ...missingTopLevel]
    });
  });

  return {
    valid: results.every((r) => r.valid),
    results
  };
}
