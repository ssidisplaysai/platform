/**
 * RuntimeTests - Genesis Runtime Diagnostics Tests
 *
 * Test suite for runtime diagnostics and component inspection.
 *
 * @module tools/genesis/tests/suites/RuntimeTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "../../../../");

/**
 * Create and return runtime diagnostics test suite
 */
export default async function createRuntimeTests() {
  const suite = new TestSuite("Runtime Diagnostics", "Runtime component inspection and diagnostics");

  suite.addTest("Runtime manifest exists", async () => {
    try {
      const manifestPath = join(
        projectRoot,
        "out/generated/runtime-boot-manifest.json"
      );
      const content = readFileSync(manifestPath, "utf8");
      const manifest = JSON.parse(content);

      if (!manifest) {
        throw new Error("Runtime manifest is empty");
      }
    } catch (error) {
      throw new Error(`Runtime manifest missing: ${error.message}`);
    }
  });

  suite.addTest("Runtime status is readable", async () => {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );
    const content = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(content);

    if (manifest.finalState === undefined) {
      throw new Error("No finalState in manifest");
    }

    if (manifest.finalState.ready === undefined) {
      throw new Error("Runtime status not available");
    }
  });

  suite.addTest("Runtime reports READY state", async () => {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );
    const content = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(content);

    if (!manifest.finalState.ready) {
      throw new Error("Runtime is not in READY state");
    }
  });

  suite.addTest("Runtime reports registered modules", async () => {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );
    const content = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(content);

    const registeredModules = manifest.finalState.registeredModules;
    if (typeof registeredModules !== "number" || registeredModules < 0) {
      throw new Error(
        `Invalid registered modules count: ${registeredModules}`
      );
    }

    if (registeredModules === 0) {
      throw new Error("No modules registered");
    }
  });

  suite.addTest("Runtime reports registered APIs", async () => {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );
    const content = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(content);

    const registeredAPIs = manifest.finalState.registeredAPIs;
    if (typeof registeredAPIs !== "number" || registeredAPIs < 0) {
      throw new Error(`Invalid registered APIs count: ${registeredAPIs}`);
    }

    if (registeredAPIs === 0) {
      throw new Error("No APIs registered");
    }
  });

  suite.addTest("Runtime reports registered workflows", async () => {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );
    const content = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(content);

    const registeredWorkflows = manifest.finalState.registeredWorkflows;
    if (typeof registeredWorkflows !== "number" || registeredWorkflows < 0) {
      throw new Error(
        `Invalid registered workflows count: ${registeredWorkflows}`
      );
    }
  });

  suite.addTest("Runtime reports registered automations", async () => {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );
    const content = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(content);

    const registeredAutomations = manifest.finalState.registeredAutomations;
    if (
      typeof registeredAutomations !== "number" ||
      registeredAutomations < 0
    ) {
      throw new Error(
        `Invalid registered automations count: ${registeredAutomations}`
      );
    }
  });

  suite.addTest("Runtime reports registered AI agents", async () => {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );
    const content = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(content);

    const registeredAgents = manifest.finalState.registeredAgents;
    if (typeof registeredAgents !== "number" || registeredAgents < 0) {
      throw new Error(
        `Invalid registered agents count: ${registeredAgents}`
      );
    }
  });

  suite.addTest("Runtime reports dependency health", async () => {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );
    const content = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(content);

    const resolved = manifest.finalState.dependenciesResolved;
    const failed = manifest.finalState.dependenciesFailed;

    if (typeof resolved !== "number" || typeof failed !== "number") {
      throw new Error("Dependency health information not available");
    }
  });

  suite.addTest("Runtime reports manifest validation status", async () => {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );
    const content = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(content);

    const validationStage = manifest.stageResults.find(
      (s) => s.stageId === "manifest-validation"
    );

    if (!validationStage) {
      throw new Error("Manifest validation stage not found");
    }

    if (
      validationStage.details.validatedCount === undefined ||
      validationStage.details.failedCount === undefined
    ) {
      throw new Error("Manifest validation status not available");
    }
  });

  suite.addTest("Runtime reports boot timing", async () => {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );
    const content = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(content);

    const bootDuration = manifest.finalState.bootDuration;
    if (typeof bootDuration !== "number" || bootDuration < 0) {
      throw new Error(`Invalid boot duration: ${bootDuration}`);
    }

    if (bootDuration === 0) {
      throw new Error("Boot timing not recorded");
    }
  });

  suite.addTest("Runtime reports discovered items total", async () => {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );
    const content = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(content);

    const totalDiscovered = manifest.finalState.totalDiscovered;
    if (typeof totalDiscovered !== "number" || totalDiscovered <= 0) {
      throw new Error(
        `Invalid total discovered count: ${totalDiscovered}`
      );
    }
  });

  suite.addTest("Runtime reports registered items total", async () => {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );
    const content = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(content);

    const totalRegistered = manifest.finalState.totalRegistered;
    if (typeof totalRegistered !== "number" || totalRegistered < 0) {
      throw new Error(
        `Invalid total registered count: ${totalRegistered}`
      );
    }
  });

  suite.addTest("Runtime diagnostics command is callable", async () => {
    try {
      const { runRuntimeCommand } = await import("../../commands/runtime.mjs");
      if (typeof runRuntimeCommand !== "function") {
        throw new Error("runRuntimeCommand is not a function");
      }
    } catch (error) {
      throw new Error(`Failed to import runtime command: ${error.message}`);
    }
  });

  return suite;
}
