import assert from "node:assert/strict";
import test from "node:test";
import { CompilerSession } from "../../../src/compiler/core/CompilerSession";

test("compiler session lifecycle, restart, and replay", () => {
  const session = new CompilerSession("session-1", "2026-01-01T00:00:00.000Z");
  assert.equal(session.currentState(), "initialized");

  session.start();
  assert.equal(session.currentState(), "running");

  session.complete("2026-01-01T00:00:01.000Z");
  assert.equal(session.currentState(), "completed");

  const restarted = session.restart("session-2", "2026-01-01T00:00:02.000Z");
  assert.equal(restarted.getMetadata().restartOfSessionId, "session-1");

  const replayed = session.replay("session-3", "2026-01-01T00:00:03.000Z");
  assert.equal(replayed.getMetadata().replayOfSessionId, "session-1");
});
