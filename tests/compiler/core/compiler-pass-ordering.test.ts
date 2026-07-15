import assert from "node:assert/strict";
import test from "node:test";

import { CompilerPassRegistry } from "../../../src/compiler/core/CompilerPassRegistry";
import type { CompilerPass } from "../../../src/compiler/core/types";

function createPass(id: string, dependencies: readonly string[] = []): CompilerPass<unknown, unknown> {
  return {
    metadata: {
      id,
      version: "1.0.0",
      description: id,
      inputType: "input",
      outputType: "output",
      dependencies,
      capabilities: [id],
      lifecycle: "active",
    },
    execute: (input) => input,
  };
}

test("pass registry resolves deterministic execution order", () => {
  const registry = new CompilerPassRegistry();
  registry.register(createPass("c", ["a", "b"]));
  registry.register(createPass("b", ["a"]));
  registry.register(createPass("a"));

  assert.deepEqual(registry.getOrderedPasses().map((pass) => pass.metadata.id), ["a", "b", "c"]);
  assert.deepEqual(registry.createExecutionPlan("1.0.0").steps.map((step) => step.passId), ["a", "b", "c"]);
});