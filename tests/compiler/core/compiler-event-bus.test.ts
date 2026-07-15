import assert from "node:assert/strict";
import test from "node:test";

import { CompilerEventBus } from "../../../src/compiler/core/CompilerEventBus";

test("event bus publishes events to subscribers and preserves history", () => {
  const bus = new CompilerEventBus();
  const received: string[] = [];
  const unsubscribe = bus.subscribe((event) => {
    received.push(event.type);
  });

  bus.publish({
    type: "CompilationStarted",
    timestamp: "2026-07-15T00:00:00.000Z",
    compilationId: "c1",
    sessionId: "s1",
    payload: {},
  });

  unsubscribe();

  bus.publish({
    type: "CompilationCompleted",
    timestamp: "2026-07-15T00:00:01.000Z",
    compilationId: "c1",
    sessionId: "s1",
    payload: {},
  });

  assert.deepEqual(received, ["CompilationStarted"]);
  assert.equal(bus.snapshot().length, 2);
});