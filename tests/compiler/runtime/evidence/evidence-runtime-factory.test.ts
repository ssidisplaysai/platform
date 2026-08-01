import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { EvidenceRuntimeFactory, type EvidenceRuntimeCreateInput } from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, 3, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createFactory() {
  return new EvidenceRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0002",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0002",
      schemaVersion: "1.0.0",
    },
    clock: createClock(),
  });
}

function createInput(): EvidenceRuntimeCreateInput {
  return {
    sourceNamespace: "discovery",
    sourceReference: "interview:42",
    canonicalLocator: "evidence://discovery/interview/42",
    title: "Customer onboarding policy",
    mediaType: "text/markdown",
    producer: "policy-office",
    capturedAt: "2026-01-01T00:00:00.000Z",
    payloadReference: "sha256:payload-0001",
    language: "en",
    tags: ["policy", "customer"],
    attributes: {
      owner: "ops",
      region: "global",
    },
    classification: {
      level: "CONFIDENTIAL",
      domain: "governance",
      handlingRequirements: ["need-to-know", "audit"],
    },
    provenance: [
      {
        sourceSystem: "discovery-pipeline",
        sourceLocator: "pdf://interview-42",
        recordedAt: "2026-01-01T00:01:00.000Z",
      },
    ],
    certificationEvidenceReferences: ["ev-z", "ev-a"],
  };
}

describe("EvidenceRuntimeFactory", () => {
  it("creates immutable evidence object with deterministic identity/hash behavior", () => {
    const left = createFactory().createEvidenceObject(createInput());
    const right = createFactory().createEvidenceObject(createInput());

    assert.equal(Object.isFrozen(left), true);
    assert.equal(Object.isFrozen(left.metadata), true);
    assert.equal(left.identity.evidenceId, right.identity.evidenceId);
    assert.equal(left.hash.digest, right.hash.digest);
    assert.equal(left.objectId, right.objectId);
    assert.equal(left.manifestReference.manifestId, right.manifestReference.manifestId);
    assert.equal(left.replayReference.sourceManifestId, left.manifestReference.manifestId);
    assert.deepEqual(left.certification.evidenceReferences, ["ev-a", "ev-z"]);
    assert.equal(left.hash.digest.length, 64);
  });

  it("evolves lifecycle and versioning with deterministic replay linkage", () => {
    const factory = createFactory();
    const created = factory.createEvidenceObject(createInput());

    const validated = factory.createNextVersion(created, {
      reason: "validation completed",
      payloadReference: "sha256:payload-0002",
      lifecycleState: "VALIDATED",
      state: "READY",
    });

    const certified = factory.createNextVersion(validated, {
      reason: "certification approved",
      payloadReference: "sha256:payload-0003",
      lifecycleState: "CERTIFIED",
      state: "ARCHIVED",
    });

    assert.equal(validated.version.ordinal, 2);
    assert.equal(validated.version.previousVersionId, created.version.versionId);
    assert.equal(certified.version.ordinal, 3);
    assert.equal(certified.lifecycle.currentState, "CERTIFIED");
    assert.equal(certified.lifecycle.history.length, 3);
    assert.equal(certified.replayReference.sourceManifestId, certified.manifestReference.manifestId);
    assert.notEqual(certified.hash.digest, created.hash.digest);
    assert.notEqual(certified.replayReference.deterministicFingerprint, created.replayReference.deterministicFingerprint);
  });

  it("enforces lifecycle transition rules", () => {
    const factory = createFactory();
    const created = factory.createEvidenceObject(createInput());

    assert.throws(
      () =>
        factory.createNextVersion(created, {
          reason: "invalid direct certification",
          payloadReference: "sha256:payload-0002",
          lifecycleState: "CERTIFIED",
        }),
      /Invalid evidence lifecycle transition: DECLARED -> CERTIFIED/,
    );
  });

  it("derives validation and health status", () => {
    const factory = createFactory();
    const created = factory.createEvidenceObject(createInput());

    const results = factory.validateEvidenceObject(created, [
      {
        name: "required-title",
        validate: (evidence) => ({
          status: evidence.metadata.title.length > 0 ? "pass" : "fail",
          code: "TITLE_PRESENT",
          message: "Title is required",
        }),
      },
      {
        name: "quarantine-check",
        validate: (evidence) => ({
          status: evidence.state === "QUARANTINED" ? "warn" : "pass",
          code: "NOT_QUARANTINED",
          message: "Evidence state should not be quarantined",
        }),
      },
    ]);

    const healthy = factory.deriveHealthStatus(created, results);
    assert.equal(healthy.status, "healthy");

    const rejected = factory.createNextVersion(created, {
      reason: "validation failed",
      payloadReference: "sha256:payload-rejected",
      lifecycleState: "REJECTED",
      state: "QUARANTINED",
    });

    const unhealthy = factory.deriveHealthStatus(rejected, results);
    assert.equal(unhealthy.status, "unhealthy");
    assert.equal(unhealthy.checks.some((check) => check.status === "fail"), true);
  });
});