import assert from "node:assert/strict";
import test from "node:test";
import { parseEntrypointArgs } from "./staging-s2g-db-admin-diagnostic.mjs";

test("diagnostic entrypoint rejects all runtime arguments", () => {
  assert.doesNotThrow(() => parseEntrypointArgs([]));
  assert.throws(() => parseEntrypointArgs(["--sql=SELECT 1"]), /DIAGNOSTIC_ENTRYPOINT_ARGUMENTS_REJECTED/);
  assert.throws(() => parseEntrypointArgs(["--diagnose-admin-readonly"]), /DIAGNOSTIC_ENTRYPOINT_ARGUMENTS_REJECTED/);
});

