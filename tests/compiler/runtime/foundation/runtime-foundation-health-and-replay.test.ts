import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { CompilerRuntimeHost, type CompilerConfiguration, type CompilerEnvironment } from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, 2, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createConfiguration(): CompilerConfiguration {
  return {
    compilerVersion: "1.0.0",
    specificationVersion: "GCS-0001-v1.0",
    programVersion: "GCI-P1-0001",
    diagnosticsLevel: "normal",
    deterministicMode: true,
    features: ["replay-bootstrap", "certification-bootstrap"],
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

describe("CompilerRuntimeHost health and replay bootstraps", () => {
  it("bootstraps deterministic artifacts and derives certification readiness from evidence refs", () => {
    const runtime = new CompilerRuntimeHost({
      configuration: createConfiguration(),
      environment: createEnvironment(),
      clock: createClock(),
    });

    runtime.initialize();
    const session = runtime.createSession("bootstrap-check");
    runtime.startSession(session.sessionId);

    const manifest = runtime.bootstrapRuntimeManifest(session.sessionId);
    const replay = runtime.bootstrapReplayContext(session.sessionId, manifest.manifestId);
    const pendingCert = runtime.bootstrapCertificationContext(session.sessionId, []);
    const readyCert = runtime.bootstrapCertificationContext(session.sessionId, ["ev-b", "ev-a"]);

    assert.equal(manifest.compilerVersion, "1.0.0");
    assert.equal(replay.sourceManifestId, manifest.manifestId);
    assert.equal(replay.deterministicFingerprint.length, 64);
    assert.equal(pendingCert.readiness, "PENDING");
    assert.equal(readyCert.readiness, "READY");
    assert.deepEqual(readyCert.evidenceReferences, ["ev-a", "ev-b"]);
  });

  it("reports failed lifecycle as unhealthy", () => {
    const runtime = new CompilerRuntimeHost({
      configuration: createConfiguration(),
      environment: createEnvironment(),
      clock: createClock(),
    });

    runtime.initialize();
    const session = runtime.createSession("failure-check");
    runtime.failSession(session.sessionId, "forced failure for health test");

    const state = runtime.getRuntimeState();
    assert.equal(state.lifecycle.currentState, "FAILED");
    assert.equal(state.health.status, "unhealthy");
    assert.equal(state.diagnostics.some((d) => d.code === "SESSION_FAILED"), true);
  });
});
