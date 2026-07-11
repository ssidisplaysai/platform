import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const genomeFiles = [
  resolve(process.cwd(), "src", "compiler", "genome", "types.ts"),
  resolve(process.cwd(), "src", "compiler", "genome", "index.ts"),
  resolve(process.cwd(), "src", "compiler", "genome", "pipeline-types.ts"),
  resolve(process.cwd(), "src", "compiler", "genome", "diagnostics.ts"),
  resolve(process.cwd(), "src", "compiler", "genome", "BusinessGenomeCompiler.ts"),
  resolve(process.cwd(), "src", "compiler", "genome", "BusinessGenomePassRegistry.ts"),
  resolve(process.cwd(), "src", "compiler", "genome", "passes", "InputValidationPass.ts"),
  resolve(process.cwd(), "src", "compiler", "genome", "passes", "CanonicalVerificationPass.ts"),
  resolve(process.cwd(), "src", "compiler", "genome", "passes", "EvidenceGroupingPass.ts"),
  resolve(process.cwd(), "src", "compiler", "genome", "passes", "EvidenceCorrelationPass.ts"),
  resolve(process.cwd(), "src", "compiler", "genome", "passes", "SemanticResolutionPass.ts"),
];

const forbiddenImportPatterns = [
  "../runtime",
  "../../runtime",
  "../../../runtime",
  "../applications",
  "../../applications",
  "../../../applications",
  "../ui",
  "../../ui",
  "../../../ui",
  "../persistence",
  "../../persistence",
  "../../../persistence",
  "../network",
  "../../network",
  "../../../network",
];

test("Business Genome contracts do not depend on Runtime or Applications", () => {
  for (const filePath of genomeFiles) {
    const content = readFileSync(filePath, "utf8");

    for (const pattern of forbiddenImportPatterns) {
      assert.equal(
        content.includes(pattern),
        false,
        `Forbidden dependency pattern found in ${filePath}: ${pattern}`,
      );
    }
  }
});
