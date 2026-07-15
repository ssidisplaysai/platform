import assert from "node:assert/strict";
import test from "node:test";

import { CompilerMetrics } from "../../../src/compiler/core/CompilerMetrics";

test("compiler metrics captures runtime counters", () => {
  const metrics = new CompilerMetrics("2026-07-15T00:00:00.000Z");
  metrics.setPassCount(3);
  metrics.incrementCompletedPasses();
  metrics.incrementWarnings(2);
  metrics.incrementErrors(1);
  metrics.incrementArtifacts(4);
  metrics.incrementEvents(5);
  metrics.complete("2026-07-15T00:00:03.000Z", 3000);

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.passCount, 3);
  assert.equal(snapshot.completedPassCount, 1);
  assert.equal(snapshot.warningCount, 2);
  assert.equal(snapshot.errorCount, 1);
  assert.equal(snapshot.durationMs, 3000);
});