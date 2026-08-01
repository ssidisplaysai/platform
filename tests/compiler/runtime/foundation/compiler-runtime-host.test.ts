import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { CompilerRuntimeHost, type CompilerConfiguration, type CompilerEnvironment } from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, 1, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createConfiguration(): CompilerConfiguration {
  return {
    compilerVersion: "1.0.0",
    specificationVersion: "GCS-0001-v1.0",
    programVersion: "GCI-P1-0001",
    diagnosticsLevel: "verbose",
    deterministicMode: true,
    features: ["lifecycle", "health", "manifest-bootstrap"],
  };
}

function createEnvironment(): CompilerEnvironment {
  return {
    environmentName: "test",
    platform: "linux",
    arch: "x64",
    nodeVersion: "v22.0.0",
    timezone: "UTC",
  };
}

describe("CompilerRuntimeHost", () => {
  it("initializes, creates immutable execution context, and shuts down gracefully", () => {
    const runtime = new CompilerRuntimeHost({
      configuration: createConfiguration(),
      environment: createEnvironment(),
      clock: createClock(),
    });

    runtime.initialize();
    const created = runtime.createSession("runtime-foundation-check");
    runtime.startSession(created.sessionId);

    const context = runtime.createExecutionContext(created.sessionId);
    assert.equal(Object.isFrozen(context), true);
    assert.equal(context.compilerVersion, "1.0.0");
    assert.equal(context.specificationVersion, "GCS-0001-v1.0");
    assert.equal(context.replay.deterministicFingerprint.length, 64);
    assert.equal(context.manifest.checksum.length, 64);

    runtime.completeSession(created.sessionId);
    runtime.shutdown("test completed");

    const state = runtime.getRuntimeState();
    assert.equal(state.lifecycle.currentState, "ARCHIVED");
    assert.equal(state.completedSessions.length, 1);
    assert.equal(state.activeSessions.length, 0);
    assert.equal(state.health.status, "degraded");
  });

  it("enforces lifecycle constraints", () => {
    const runtime = new CompilerRuntimeHost({
      configuration: createConfiguration(),
      environment: createEnvironment(),
      clock: createClock(),
    });

    assert.throws(() => runtime.createSession("not-ready"), /DECLARED/);

    runtime.initialize();
    const session = runtime.createSession("constraint-check");
    assert.throws(() => runtime.completeSession(session.sessionId), /cannot complete/i);

    runtime.startSession(session.sessionId);
    runtime.completeSession(session.sessionId);

    assert.throws(() => runtime.startSession(session.sessionId), /cannot start/i);
  });
});
