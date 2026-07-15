import assert from "node:assert/strict";
import test from "node:test";

import { CompilerKernel } from "../../../src/compiler/core/CompilerKernel";
import { CompilerPassRegistry } from "../../../src/compiler/core/CompilerPassRegistry";
import { CompilerPipeline } from "../../../src/compiler/core/CompilerPipeline";
import type { CompilerPass } from "../../../src/compiler/core/types";

function createPass(
  id: string,
  dependencies: readonly string[] = [],
  execute: (input: unknown) => unknown = (input) => input,
): CompilerPass<unknown, unknown> {
  return {
    metadata: {
      id,
      version: "1.0.0",
      description: `${id} pass`,
      inputType: "input",
      outputType: `${id}.output`,
      dependencies,
      capabilities: [id],
      lifecycle: "active",
      kind: "execution",
    },
    execute,
  };
}

test("compiler kernel executes a deterministic pipeline and returns structured result", async () => {
  const registry = new CompilerPassRegistry();
  registry.register(createPass("a", [], (input) => ({ input, stage: "a" })));
  registry.register(createPass("b", ["a"], (input) => ({ previous: input, stage: "b" })));

  const kernel = new CompilerKernel(new CompilerPipeline({ registry }));
  const result = await kernel.compile({ sample: true }, { sessionId: "kernel-session", startedAt: "2026-07-15T00:00:00.000Z" });

  assert.equal(result.success, true);
  assert.equal(result.status, "completed");
  assert.equal(result.sessionId, "kernel-session");
  assert.equal(Object.keys(result.outputs).join(","), "a,b");
  assert.equal(result.artifactsProduced.length, 2);
  assert.equal(result.metrics.completedPassCount, 2);
});