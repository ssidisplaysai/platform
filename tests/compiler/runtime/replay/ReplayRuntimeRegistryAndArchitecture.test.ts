import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EvidenceRuntimeFactory,
  EvidenceValidationRuntimeFactory,
  ManifestRuntimeFactory,
  ReplayRuntimeFactory,
  ReplayRuntimeRegistry,
  type EvidenceRuntimeCreateInput,
} from "../../../../src/compiler/runtime";

function createClock(seed: number) {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, seed, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createEvidenceFactory(seed = 12) {
  return new EvidenceRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0005",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0005",
      schemaVersion: "1.0.0",
    },
    clock: createClock(seed),
  });
}

function createValidationFactory(seed = 12) {
  return new EvidenceValidationRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0005",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0005",
      schemaVersion: "1.0.0",
    },
    clock: createClock(seed),
  });
}

function createManifestFactory(seed = 12) {
  return new ManifestRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0005",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0005",
      schemaVersion: "1.0.0",
    },
    clock: createClock(seed),
  });
}

function createReplayFactory(seed = 12) {
  return new ReplayRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0005",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0005",
      schemaVersion: "1.0.0",
    },
    clock: createClock(seed),
  });
}

function createInput(sourceReference: string): EvidenceRuntimeCreateInput {
  return {
    sourceNamespace: "replay",
    sourceReference,
    canonicalLocator: `evidence://replay/${sourceReference}`,
    title: `Evidence ${sourceReference}`,
    mediaType: "application/json",
    producer: "runtime-tests",
    capturedAt: "2026-01-12T00:00:00.000Z",
    payloadReference: `sha256:${sourceReference}`,
    certificationEvidenceReferences: ["ev-a"],
  };
}

function createReplayInput(sourceReference: string) {
  const evidence = createEvidenceFactory().createEvidenceObject(createInput(sourceReference));
  const validation = createValidationFactory().createValidationRecord(evidence, [
    {
      name: "always-pass",
      validate: () => ({
        status: "pass",
        code: "PASS",
        message: "pass",
      }),
    },
  ]);

  const manifest = createManifestFactory().createManifestRecord([validation], [], {
    reason: `manifest-${sourceReference}`,
  });

  return {
    manifest,
    validationRecords: [validation],
    evidenceObjects: [evidence],
  };
}

const replayRuntimeFiles = [
  "src/compiler/runtime/replay/contracts.ts",
  "src/compiler/runtime/replay/ReplayRuntimeFactory.ts",
  "src/compiler/runtime/replay/ReplayRuntimeRegistry.ts",
  "src/compiler/runtime/replay/index.ts",
];

const forbiddenTerms = [
  "IBR",
  "EntityRuntime",
  "RelationshipRuntime",
  "RuleRuntime",
  "GenomeAssembly",
  "CompilerPass",
  "CompilerPipeline",
  "Ingestion",
  "OCR",
  "Crawler",
  "Queue",
  "Worker",
  "Persistence",
  "Scheduling",
  "AIModel",
  "LLM",
];

describe("ReplayRuntimeRegistry and architecture guardrails", () => {
  it("registers and retrieves deterministic replay records", () => {
    const registry = new ReplayRuntimeRegistry({
      factory: createReplayFactory(),
      clock: createClock(12),
      rules: [],
    });

    const input = createReplayInput("registry-alpha");
    const registration = registry.register(input, { reason: "register-replay" });

    assert.equal(registry.count(), 1);

    const fetched = registry.getByReplayIdAndVersion(registration.record.replayId, registration.record.version.versionId);

    assert.notEqual(fetched, undefined);
    assert.equal(fetched?.record.replayDigest, registration.record.replayDigest);
    assert.equal(Object.isFrozen(fetched), true);
  });

  it("keeps ordering deterministic and supports delete path", () => {
    const registry = new ReplayRuntimeRegistry({
      factory: createReplayFactory(),
      clock: createClock(13),
      rules: [],
    });

    const right = registry.register(createReplayInput("registry-beta"), { reason: "register-beta" });
    const left = registry.register(createReplayInput("registry-alpha"), { reason: "register-alpha" });

    const listed = registry.listAll();
    assert.equal(listed.length, 2);
    assert.equal(listed[0]?.record.replayId <= listed[1]?.record.replayId, true);

    assert.equal(registry.deleteByReplayIdAndVersion(left.record.replayId, left.record.version.versionId), true);
    assert.equal(registry.count(), 1);
    assert.equal(
      registry.getByReplayIdAndVersion(right.record.replayId, right.record.version.versionId)?.record.replayId,
      right.record.replayId,
    );
  });

  it("overwrites duplicate replay registration and keeps size stable", () => {
    const registry = new ReplayRuntimeRegistry({
      factory: createReplayFactory(),
      clock: createClock(14),
      rules: [
        {
          name: "stable-pass",
          validate: () => ({
            status: "pass",
            code: "PASS",
            message: "pass",
          }),
        },
      ],
    });

    const input = createReplayInput("duplicate-alpha");

    const first = registry.register(input, { reason: "duplicate-case" });
    assert.equal(registry.count(), 1);

    const second = registry.register(input, { reason: "duplicate-case" });
    assert.equal(registry.count(), 1);

    const fetched = registry.getByReplayIdAndVersion(second.record.replayId, second.record.version.versionId);
    assert.notEqual(fetched, undefined);
    assert.equal(fetched?.record.replayId, second.record.replayId);
    assert.equal(fetched?.record.version.versionId, second.record.version.versionId);
    assert.equal(fetched?.record.replayDigest, first.record.replayDigest);
  });

  it("stays within authorized architecture boundaries", () => {
    for (const relativePath of replayRuntimeFiles) {
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