import assert from "node:assert/strict";
import test from "node:test";

import { CompilerPassRegistry } from "../../../src/compiler/core/CompilerPassRegistry";
import { CompilerPipeline } from "../../../src/compiler/core/CompilerPipeline";
import type { CompilerPass } from "../../../src/compiler/core/types";

const pass: CompilerPass<{ readonly id: string }, { readonly id: string }> = {
  metadata: {
    id: "result-pass",
    version: "1.0.0",
    description: "result pass",
    inputType: "input",
    outputType: "artifact",
    dependencies: [],
    capabilities: ["result"],
    lifecycle: "active",
  },
  execute: (input) => input,
};

test("compiler result includes required production fields", async () => {
  const registry = new CompilerPassRegistry();
  registry.register(pass);

  const result = await new CompilerPipeline({ registry }).compile({ id: "demo" }, { startedAt: "2026-07-15T00:00:00.000Z" });

  assert.equal(typeof result.success, "boolean");
  assert.equal(result.compilerVersion, "1.0.0");
  assert.equal(result.pipelineVersion, "1.0.0");
  assert.equal(result.artifactsProduced.length, 1);
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.manifest.sessionId.length > 0, true);
});