import assert from "node:assert/strict";
import { MetadataRuntime } from "./MetadataRuntime";

async function runRuntimeBootTest(): Promise<void> {
  const runtime = new MetadataRuntime();
  const result = await runtime.boot();

  assert.equal(result.ready, true, "Runtime should report ready after boot.");
  assert.equal(runtime.isReady, true, "Runtime should expose a ready state.");
  assert.equal(
    result.registeredDefinitions.some(
      (definition) => definition.entityType === "customer",
    ),
    true,
    "Runtime should register the customer definition.",
  );
  assert.equal(
    result.registeredDefinitions.length > 0,
    true,
    "Runtime should summarize at least one registered definition.",
  );
}

runRuntimeBootTest()
  .then(() => {
    console.log("MetadataRuntime boot test passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
