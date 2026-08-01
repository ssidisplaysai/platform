import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const foundationFiles = [
  "src/compiler/runtime/foundation/CompilerRuntimeHost.ts",
  "src/compiler/runtime/foundation/contracts.ts",
  "src/compiler/runtime/foundation/immutability.ts",
  "src/compiler/runtime/foundation/index.ts",
];

const forbiddenTerms = [
  "EvidenceRuntime",
  "EntityResolution",
  "RelationshipResolution",
  "RuleEngine",
  "GenomeAssembly",
  "BusinessLogic",
  "CompilerPass",
  "DiscoveryCompilerPass",
  "EvidenceCompilerPass",
];

describe("Runtime foundation architecture boundaries", () => {
  it("remains phase-1 scoped with no compiler-domain runtime implementation", () => {
    for (const relativePath of foundationFiles) {
      const absolutePath = resolve(process.cwd(), relativePath);
      const content = readFileSync(absolutePath, "utf8");

      for (const forbidden of forbiddenTerms) {
        assert.equal(
          content.includes(forbidden),
          false,
          `${relativePath} must not include forbidden phase-2+ term: ${forbidden}`,
        );
      }
    }
  });
});
