import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "@jest/globals";

const FILES = [
  "src/compiler/runtime/ibr/contracts.ts",
  "src/compiler/runtime/ibr/IBRRuntimeFactory.ts",
  "src/compiler/runtime/ibr/IBRRuntimeRegistry.ts",
  "src/compiler/runtime/ibr/index.ts",
] as const;

const FORBIDDEN_IMPORTS = [
  "/entity/",
  "/relationship/",
  "/rule/",
  "/genome/",
  "/persistence/",
  "/schedule/",
  "/orchestration/",
  "/execution/",
  "/ocr/",
  "/crawler/",
  "/queue/",
  "/worker/",
  "/deploy/",
  "llm",
];

describe("IBRRuntime architecture boundaries", () => {
  it("keeps the implementation inside the approved runtime and utility surface", () => {
    const expectations: Readonly<Record<string, readonly string[]>> = {
      "src/compiler/runtime/ibr/contracts.ts": ["../evidence/contracts", "../evidence-validation/contracts", "../manifest/contracts", "../replay/contracts"],
      "src/compiler/runtime/ibr/IBRRuntimeFactory.ts": ["../foundation/immutability", "../../provenance/SourceHash", "../../core/stableStringify"],
      "src/compiler/runtime/ibr/IBRRuntimeRegistry.ts": ["../foundation/immutability"],
      "src/compiler/runtime/ibr/index.ts": [],
    };

    for (const relativePath of FILES) {
      const source = readFileSync(relativePath, "utf8");

      for (const expectedImport of expectations[relativePath]) {
        assert.equal(source.includes(expectedImport), true);
      }

      for (const forbidden of FORBIDDEN_IMPORTS) {
        assert.equal(source.includes(forbidden), false);
      }
    }
  });
});
