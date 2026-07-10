import assert from "node:assert/strict";
import test from "node:test";
import { CompilerDiagnosticsEngine } from "../../../src/compiler/core/CompilerDiagnosticsEngine";

test("diagnostics engine aggregates and filters diagnostics", () => {
  const diagnostics = new CompilerDiagnosticsEngine();
  diagnostics.report("info", "I1", "info");
  diagnostics.report("warning", "W1", "warning");
  diagnostics.report("error", "E1", "error");
  diagnostics.architectureObservation("boundary question", { id: "AO-1" });

  assert.equal(diagnostics.list().length, 4);
  assert.equal(diagnostics.listBySeverity("error").length, 1);
  assert.equal(diagnostics.hasErrors(), true);
});
