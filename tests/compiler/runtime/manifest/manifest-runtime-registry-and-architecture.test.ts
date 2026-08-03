import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EvidenceRuntimeFactory,
  EvidenceValidationRuntimeFactory,
  ManifestRuntimeFactory,
  ManifestRuntimeRegistry,
  type EvidenceRuntimeCreateInput,
} from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, 8, 0, 0, step)).toISOString();
    step += 1;
    return value;
  };
}

function createEvidenceFactory() {
  return new EvidenceRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0004",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0004",
      schemaVersion: "1.0.0",
    },
    clock: createClock(),
  });
}

function createValidationFactory() {
  return new EvidenceValidationRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0004",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0004",
      schemaVersion: "1.0.0",
    },
    clock: createClock(),
  });
}

function createManifestFactory() {
  return new ManifestRuntimeFactory({
    configuration: {
      runtimeId: "runtime-gci-p1-0004",
      compilerVersion: "1.0.0",
      specificationVersion: "GCS-0001-v1.0",
      programVersion: "GCI-P1-0004",
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
    certificationEvidenceReferences: ["ev-a"],
  };
}

function createValidationRecord(sourceReference: string) {
  const evidence = createEvidenceFactory().createEvidenceObject(createInput(sourceReference));
  return createValidationFactory().createValidationRecord(evidence, [
    {
      name: "always-pass",
      validate: () => ({
        status: "pass",
        code: "PASS",
        message: "pass",
      }),
    },
  ]);
}

const manifestRuntimeFiles = [
  "src/compiler/runtime/manifest/contracts.ts",
  "src/compiler/runtime/manifest/ManifestRuntimeFactory.ts",
  "src/compiler/runtime/manifest/ManifestRuntimeRegistry.ts",
  "src/compiler/runtime/manifest/index.ts",
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

describe("ManifestRuntimeRegistry and architecture guardrails", () => {
  it("registers and retrieves deterministic manifest records", () => {
    const alpha = createValidationRecord("registry-alpha");
    const beta = createValidationRecord("registry-beta");

    const registry = new ManifestRuntimeRegistry({
      factory: createManifestFactory(),
      clock: createClock(),
      rules: [
        {
          name: "has-sources",
          validate: (records) => ({
            status: records.length > 0 ? "pass" : "fail",
            code: "HAS_SOURCES",
            message: "manifest requires source records",
          }),
        },
      ],
    });

    const registration = registry.register([beta, alpha], {
      reason: "register-manifest",
    });

    assert.equal(registry.count(), 1);

    const fetched = registry.getByManifestIdAndVersion(
      registration.record.manifestId,
      registration.record.version.versionId,
    );

    assert.notEqual(fetched, undefined);
    assert.equal(fetched?.record.manifestDigest, registration.record.manifestDigest);
    assert.equal(Object.isFrozen(fetched), true);
  });

  it("keeps ordering deterministic and supports delete path", () => {
    const alpha = createValidationRecord("order-alpha");
    const beta = createValidationRecord("order-beta");

    const registry = new ManifestRuntimeRegistry({
      factory: createManifestFactory(),
      clock: createClock(),
      rules: [],
    });

    const right = registry.register([beta], { reason: "register-beta" });
    const left = registry.register([alpha], { reason: "register-alpha" });

    const listed = registry.listAll();
    assert.equal(listed.length, 2);
    assert.equal(listed[0]?.record.manifestId <= listed[1]?.record.manifestId, true);

    assert.equal(
      registry.deleteByManifestIdAndVersion(left.record.manifestId, left.record.version.versionId),
      true,
    );
    assert.equal(registry.count(), 1);
    assert.equal(
      registry.getByManifestIdAndVersion(right.record.manifestId, right.record.version.versionId)?.record.manifestId,
      right.record.manifestId,
    );
  });

  it("overwrites duplicate manifest registration and keeps size stable", () => {
    const alpha = createValidationRecord("duplicate-alpha");

    const registry = new ManifestRuntimeRegistry({
      factory: createManifestFactory(),
      clock: createClock(),
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

    const first = registry.register([alpha], { reason: "duplicate-case" });
    assert.equal(registry.count(), 1);

    const second = registry.register([alpha], { reason: "duplicate-case" });
    assert.equal(registry.count(), 1);

    const fetched = registry.getByManifestIdAndVersion(second.record.manifestId, second.record.version.versionId);
    assert.notEqual(fetched, undefined);
    assert.equal(fetched?.record.manifestId, second.record.manifestId);
    assert.equal(fetched?.record.version.versionId, second.record.version.versionId);
    assert.equal(fetched?.record.replayTrace.deterministicFingerprint, first.record.replayTrace.deterministicFingerprint);
  });

  it("stays within authorized architecture boundaries", () => {
    for (const relativePath of manifestRuntimeFiles) {
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
