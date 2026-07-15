import assert from "node:assert/strict";
import test from "node:test";

import { CompilerDiagnostics } from "../../../src/compiler/core/CompilerDiagnostics";

test("compiler diagnostics sorts and filters deterministically", () => {
  const diagnostics = new CompilerDiagnostics();
  diagnostics.report("warning", "W2", "second warning");
  diagnostics.report("error", "E1", "first error");
  diagnostics.report("warning", "W1", "first warning");

  assert.deepEqual(
    diagnostics.list().map((diagnostic) => diagnostic.code),
    ["E1", "W1", "W2"],
  );
  assert.equal(diagnostics.hasErrors(), true);
  assert.equal(diagnostics.listBySeverity("warning").length, 2);
});