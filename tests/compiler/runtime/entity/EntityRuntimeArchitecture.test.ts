import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "@jest/globals";

const FILES = [
  "src/compiler/runtime/entity/contracts.ts",
  "src/compiler/runtime/entity/EntityRuntimeFactory.ts",
  "src/compiler/runtime/entity/EntityRuntimeRegistry.ts",
  "src/compiler/runtime/entity/index.ts",
] as const;

const FORBIDDEN_IMPORTS = [
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
  "probabilistic",
  "heuristic",
];

describe("EntityRuntime architecture boundaries", () => {
  it("keeps implementation inside authorized contract and utility surface", () => {
    const expectations: Readonly<Record<string, readonly string[]>> = {
      "src/compiler/runtime/entity/contracts.ts": ["../ibr/contracts"],
      "src/compiler/runtime/entity/EntityRuntimeFactory.ts": [
        "../foundation/immutability",
        "../../provenance/SourceHash",
        "../../core/stableStringify",
      ],
      "src/compiler/runtime/entity/EntityRuntimeRegistry.ts": ["../foundation/immutability"],
      "src/compiler/runtime/entity/index.ts": [],
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
