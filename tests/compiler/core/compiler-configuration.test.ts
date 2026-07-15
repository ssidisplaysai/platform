import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_COMPILER_CONFIGURATION,
  createCompilerConfiguration,
} from "../../../src/compiler/core/CompilerConfiguration";

test("compiler configuration applies overrides without mutating defaults", () => {
  const config = createCompilerConfiguration({ stopOnError: false, standards: { gcc0001: "1.1" } });

  assert.equal(DEFAULT_COMPILER_CONFIGURATION.stopOnError, true);
  assert.equal(config.stopOnError, false);
  assert.equal(config.standards.gcc0001, "1.1");
  assert.equal(Object.isFrozen(config), true);
});