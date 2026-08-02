import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EvidenceRuntimeFactory,
  EvidenceValidationRuntimeFactory,
  EvidenceValidationRuntimeRegistry,
  type EvidenceRuntimeCreateInput,
} from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, 6, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createEvidenceFactory() {
  return new EvidenceRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0003",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0003",
      schemaVersion: "1.0.0",
    },
    clock: createClock(),
  });
}

function createValidationFactory() {
  return new EvidenceValidationRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0003",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0003",
      schemaVersion: "1.0.0",
    },
    clock: createClock(),
  });
}

function createInput(sourceReference: string): EvidenceRuntimeCreateInput {
  return {
    sourceNamespace: "discovery",
    sourceReference,
    canonicalLocator: `evidence://discovery/${sourceReference}`,
    title: `Evidence ${sourceReference}`,
    mediaType: "application/json",
    producer: "runtime-tests",
    capturedAt: "2026-01-01T00:00:00.000Z",
    payloadReference: `sha256:${sourceReference}`,
  };
}

const validationRuntimeFiles = [
  "src/compiler/runtime/evidence-validation/contracts.ts",
  "src/compiler/runtime/evidence-validation/EvidenceValidationRuntimeFactory.ts",
  "src/compiler/runtime/evidence-validation/EvidenceValidationRuntimeRegistry.ts",
  "src/compiler/runtime/evidence-validation/index.ts",
];

const forbiddenTerms = [
  "ManifestRuntime",
  "ReplayRuntime",
  "IBR",
  "EntityResolution",
  "RelationshipResolution",
  "RuleEngine",
  "GenomeAssembly",
  "DiscoveryCompilerPass",
  "EvidenceCompilerPass",
  "OCR",
  "Crawler",
  "Queue",
  "Worker",
  "AIModel",
  "Persistence",
  "Scheduling",
];

describe("EvidenceValidationRuntimeRegistry and architecture guardrails", () => {
  it("registers and retrieves deterministic validation records by evidence id and version", () => {
    const evidenceFactory = createEvidenceFactory();
    const validationFactory = createValidationFactory();

    const registry = new EvidenceValidationRuntimeRegistry({
      factory: validationFactory,
      clock: createClock(),
      rules: [
        {
          name: "title-check",
          validate: (evidence) => ({
            status: evidence.metadata.title.length > 0 ? "pass" : "fail",
            code: "TITLE_CHECK",
            message: "title checked",
          }),
        },
      ],
    });

    const first = evidenceFactory.createEvidenceObject(createInput("registry-ref"));
    const second = evidenceFactory.createNextVersion(first, {
      reason: "updated",
      payloadReference: "sha256:registry-ref-v2",
      lifecycleState: "VALIDATED",
      state: "READY",
    });

    const firstRegistration = registry.register(first);
    const secondRegistration = registry.register(second);

    assert.equal(registry.count(), 2);
    assert.equal(firstRegistration.record.outcome, "VALID");
    assert.equal(secondRegistration.record.outcome, "VALID");

    const fetched = registry.getByEvidenceIdAndVersion(first.identity.evidenceId, second.version.versionId);
    assert.notEqual(fetched, undefined);
    assert.equal(fetched?.record.evidenceVersionId, second.version.versionId);
    assert.equal(Object.isFrozen(fetched), true);
  });

  it("keeps registry ordering deterministic and supports delete path", () => {
    const evidenceFactory = createEvidenceFactory();
    const validationFactory = createValidationFactory();

    const registry = new EvidenceValidationRuntimeRegistry({
      factory: validationFactory,
      clock: createClock(),
      rules: [
        {
          name: "always-pass",
          validate: () => ({
            status: "pass",
            code: "PASS",
            message: "pass",
          }),
        },
      ],
    });

    const left = evidenceFactory.createEvidenceObject(createInput("a"));
    const right = evidenceFactory.createEvidenceObject(createInput("b"));

    registry.register(right);
    registry.register(left);

    const listed = registry.listAll();
    assert.equal(listed.length, 2);
    assert.equal(listed[0]?.record.evidenceId <= listed[1]?.record.evidenceId, true);

    assert.equal(registry.deleteByEvidenceIdAndVersion(left.identity.evidenceId, left.version.versionId), true);
    assert.equal(registry.count(), 1);
  });

  it("overwrites duplicate evidence id and version registration while keeping registry size stable", () => {
    const evidenceFactory = createEvidenceFactory();
    const validationFactory = createValidationFactory();

    const registry = new EvidenceValidationRuntimeRegistry({
      factory: validationFactory,
      clock: createClock(),
      rules: [
        {
          name: "deterministic-pass",
          validate: () => ({
            status: "pass",
            code: "PASS",
            message: "pass",
          }),
        },
      ],
    });

    const evidence = evidenceFactory.createEvidenceObject(createInput("duplicate-key-ref"));

    const firstRegistration = registry.register(evidence);
    assert.equal(registry.count(), 1);

    const secondRegistration = registry.register(evidence);
    assert.equal(registry.count(), 1);

    const stored = registry.getByEvidenceIdAndVersion(evidence.identity.evidenceId, evidence.version.versionId);
    assert.notEqual(stored, undefined);
    assert.equal(stored?.record.validationId, secondRegistration.record.validationId);
    assert.equal(stored?.record.evidenceVersionId, evidence.version.versionId);
    assert.equal(stored?.record.replayTrace.sourceReplayId, firstRegistration.record.replayTrace.sourceReplayId);
    assert.equal(
      stored?.record.replayTrace.validationDeterministicFingerprint,
      secondRegistration.record.replayTrace.validationDeterministicFingerprint,
    );
  });

  it("stays within authorized architecture boundaries", () => {
    for (const relativePath of validationRuntimeFiles) {
      const absolutePath = resolve(process.cwd(), relativePath);
      const content = readFileSync(absolutePath, "utf8");

      for (const forbidden of forbiddenTerms) {
        assert.equal(
          content.includes(forbidden),
          false,
          `${relativePath} must not include out-of-scope term: ${forbidden}`,
        );
      }
    }
  });
});
