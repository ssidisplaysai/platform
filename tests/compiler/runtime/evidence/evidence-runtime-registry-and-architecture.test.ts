import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EvidenceRuntimeFactory,
  EvidenceRuntimeRegistry,
  type EvidenceRuntimeCreateInput,
} from "../../../../src/compiler/runtime";

function createClock() {
  let step = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 0, 4, 0, 0, step)).toISOString();
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

const evidenceRuntimeFiles = [
  "src/compiler/runtime/evidence/contracts.ts",
  "src/compiler/runtime/evidence/EvidenceRuntimeFactory.ts",
  "src/compiler/runtime/evidence/EvidenceRuntimeRegistry.ts",
  "src/compiler/runtime/evidence/index.ts",
];

const forbiddenTerms = [
  "OCR",
  "Parser",
  "Adapter",
  "Crawler",
  "IngestionPipeline",
  "Queue",
  "Worker",
  "Extraction",
  "Normalization",
  "IBR",
  "EntityResolution",
  "RelationshipResolution",
  "RuleEngine",
  "GenomeAssembly",
  "AIModel",
  "DiscoveryCompilerPass",
  "EvidenceCompilerPass",
];

describe("EvidenceRuntimeRegistry and architecture guardrails", () => {
  it("registers, retrieves, lists, and deletes evidence runtime objects", () => {
    const factory = createFactory();
    const registry = new EvidenceRuntimeRegistry({
      factory,
      clock: createClock(),
      validators: [
        {
          name: "ready-state-validator",
          validate: (evidence) => ({
            status: evidence.state === "PENDING_VALIDATION" ? "pass" : "warn",
            code: "STATE_CHECK",
            message: "State inspected",
          }),
        },
      ],
    });

    const first = factory.createEvidenceObject(createInput("ref-1"));
    const second = factory.createEvidenceObject(createInput("ref-2"));

    const firstRecord = registry.register(first);
    registry.register(second);

    assert.equal(registry.count(), 2);
    assert.equal(firstRecord.validation.length, 1);
    assert.equal(firstRecord.health.status, "healthy");
    assert.equal(Object.isFrozen(firstRecord), true);

    const fetched = registry.getByEvidenceId(first.identity.evidenceId);
    assert.notEqual(fetched, undefined);
    assert.equal(fetched?.evidence.objectId, first.objectId);

    const listed = registry.listAll();
    assert.equal(listed.length, 2);
    assert.equal(Object.isFrozen(listed), true);
    assert.equal(registry.deleteByEvidenceId(first.identity.evidenceId), true);
    assert.equal(registry.count(), 1);
  });

  it("stays within runtime-only architecture boundaries", () => {
    for (const relativePath of evidenceRuntimeFiles) {
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