import assert from "node:assert/strict";
import test from "node:test";

import { CompilerCancellation } from "../../../src/compiler/core/CompilerCancellation";
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
      kind: id.includes("validation") ? "validation" : "execution",
    },
    execute,
  };
}

test("pipeline emits lifecycle events in pass order", async () => {
  const registry = new CompilerPassRegistry();
  registry.register(createPass("first", [], () => ({ first: true })));
  registry.register(createPass("second", ["first"], () => ({ second: true })));

  const pipeline = new CompilerPipeline({ registry });
  const result = await pipeline.compile({ ok: true }, { sessionId: "event-session", startedAt: "2026-07-15T00:00:00.000Z" });
  const events = pipeline.eventBus.snapshot();

  assert.equal(result.success, true);
  assert.deepEqual(
    events.map((event) => event.type),
    ["CompilationStarted", "PassStarted", "PassCompleted", "PassStarted", "PassCompleted", "CompilationCompleted"],
  );
});

test("pipeline respects cancellation before pass execution", async () => {
  const registry = new CompilerPassRegistry();
  registry.register(createPass("first", [], () => ({ first: true })));

  const cancellation = new CompilerCancellation();
  cancellation.cancel("stop");

  const pipeline = new CompilerPipeline({ registry });
  const result = await pipeline.compile({ ok: true }, { cancellation, startedAt: "2026-07-15T00:00:00.000Z" });

  assert.equal(result.success, false);
  assert.equal(result.status, "cancelled");
  assert.equal(result.errors.length, 1);
});