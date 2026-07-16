import assert from "node:assert/strict";
import test from "node:test";
import type { BusinessGenomeIR, GenomeEntity, GenomeEvent, GenomeProcess, GenomeWorkflow } from "../../../src/compiler/business-genome/BusinessGenomeIR";
import { BlueprintCompiler } from "../../../src/compiler/blueprint/BlueprintCompiler";

function baseVersion() {
  return {
    semver: "1.0.0",
    revision: 1,
    compiledAt: "2026-01-01T00:00:00.000Z",
    supersedes: null,
    supersededBy: null,
  } as const;
}

function baseTemporal() {
  return {
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: null,
    observedAt: "2026-01-01T00:00:00.000Z",
    compiledAt: "2026-01-01T00:00:00.000Z",
    supersedes: null,
    supersededBy: null,
  } as const;
}

function baseLineage(sourceKnowledgeId: string) {
  return {
    sourceKnowledgeId,
    sourceEvidenceIds: ["ev-1"],
    sourceDocument: "interview.md",
    sourceInterviewId: "int-1",
    compilerStage: "stage-4-business-genome-compiler",
    transformationVersion: "1.0.0",
    validationResult: "valid" as const,
    transformationPath: ["stage-3-knowledge-compiler", "stage-4-business-genome-compiler"],
  };
}

function baseProvenance(sourceKnowledgeId: string) {
  return {
    sourceKnowledgeId,
    sourceEvidenceId: "ev-1",
    sourceEvidenceIdentity: "ev-1",
    sourceDocument: "interview.md",
    sourceInterviewId: "int-1",
    sourceType: "markdown",
    sourceOrigin: "interview.md",
    compilerStage: "stage-4-business-genome-compiler",
    transformationVersion: "1.0.0",
    validationResult: "valid" as const,
  };
}

function baseConfidence(value = 0.8) {
  return {
    initial: value,
    current: value,
    method: "fixture",
    factors: {},
    rationale: ["fixture"],
  };
}

function buildEntity(id: string, name: string): GenomeEntity {
  return {
    identity: {
      id: id,
      kind: "entity",
      objectType: "organization",
      enterpriseScope: "enterprise",
      relationshipScope: "entity",
      temporalScope: "2026-open",
      lineageSignature: "lineage",
      versionSemantics: "1.0.0",
    },
    canonicalName: name,
    canonicalContent: "Operations domain process policy workflow event",
    confidence: baseConfidence(),
    lineage: baseLineage(id),
    provenance: baseProvenance(id),
    temporalValidity: baseTemporal(),
    version: baseVersion(),
    conflictIds: [],
    metadata: { domain: "operations" },
    entityType: "organization",
  };
}

function buildProcess(): GenomeProcess {
  return {
    ...buildEntity("gen-process-1", "Order Handling") as unknown as GenomeProcess,
    identity: {
      ...buildEntity("gen-process-1", "Order Handling").identity,
      kind: "process",
      objectType: "process",
    },
    processType: "enterprise-process",
    relatedEntityIds: ["gen-entity-1"],
  };
}

function buildEvent(): GenomeEvent {
  return {
    ...buildEntity("gen-event-1", "Order Created") as unknown as GenomeEvent,
    identity: {
      ...buildEntity("gen-event-1", "Order Created").identity,
      kind: "event",
      objectType: "event",
    },
    eventType: "domain-event",
    workflowId: null,
  };
}

function buildWorkflow(): GenomeWorkflow {
  return {
    ...buildEntity("gen-workflow-1", "Order Lifecycle") as unknown as GenomeWorkflow,
    identity: {
      ...buildEntity("gen-workflow-1", "Order Lifecycle").identity,
      kind: "workflow",
      objectType: "workflow",
    },
    workflowType: "business-workflow",
    processIds: ["gen-process-1"],
    eventIds: ["gen-event-1"],
  };
}

function buildBusinessGenomeIR(): BusinessGenomeIR {
  const entityA = buildEntity("gen-entity-1", "Operations Team");
  const entityB = buildEntity("gen-entity-2", "Platform System");
  const process = buildProcess();
  const event = buildEvent();
  const workflow = buildWorkflow();

  return {
    schemaVersion: "1.0.0",
    businessGenome: {
      version: "1.0.0",
      generatedAt: "2026-01-01T00:00:00.000Z",
      entities: [entityA, entityB],
      relationships: [
        {
          ...entityA,
          identity: {
            ...entityA.identity,
            id: "gen-rel-1",
            kind: "relationship",
            objectType: "supports",
          },
          relationshipType: "supports",
          sourceEntityId: entityA.identity.id,
          targetEntityId: entityB.identity.id,
        },
      ],
      capabilities: [
        {
          ...entityA,
          identity: {
            ...entityA.identity,
            id: "gen-cap-1",
            kind: "capability",
            objectType: "capability",
          },
          capabilityType: "operational",
          entityId: entityA.identity.id,
        },
      ],
      processes: [process],
      policies: [
        {
          ...entityA,
          identity: {
            ...entityA.identity,
            id: "gen-policy-1",
            kind: "policy",
            objectType: "policy",
          },
          policyType: "governance",
          ruleIds: ["gen-rule-1"],
        },
      ],
      rules: [
        {
          ...entityA,
          identity: {
            ...entityA.identity,
            id: "gen-rule-1",
            kind: "rule",
            objectType: "rule",
          },
          ruleType: "constraint",
          policyId: "gen-policy-1",
        },
      ],
      roles: [
        {
          ...entityA,
          identity: {
            ...entityA.identity,
            id: "gen-role-1",
            kind: "role",
            objectType: "role",
          },
          roleType: "owner",
          responsibilityIds: ["gen-resp-1"],
        },
      ],
      responsibilities: [
        {
          ...entityA,
          identity: {
            ...entityA.identity,
            id: "gen-resp-1",
            kind: "responsibility",
            objectType: "responsibility",
          },
          responsibilityType: "operational",
          roleId: "gen-role-1",
          processId: process.identity.id,
        },
      ],
      resources: [
        {
          ...entityB,
          identity: {
            ...entityB.identity,
            id: "gen-resource-1",
            kind: "resource",
            objectType: "resource",
          },
          resourceType: "database",
          ownerRoleId: "gen-role-1",
        },
      ],
      events: [event],
      workflows: [workflow],
      constraints: [
        {
          ...entityA,
          identity: {
            ...entityA.identity,
            id: "gen-constraint-1",
            kind: "constraint",
            objectType: "constraint",
          },
          constraintType: "business",
          constrainedObjectIds: [entityA.identity.id],
        },
      ],
      metrics: [
        {
          ...entityA,
          identity: {
            ...entityA.identity,
            id: "gen-metric-1",
            kind: "metric",
            objectType: "metric",
          },
          metricType: "kpi",
          targetObjectIds: [entityA.identity.id],
        },
      ],
      objectives: [
        {
          ...entityA,
          identity: {
            ...entityA.identity,
            id: "gen-objective-1",
            kind: "objective",
            objectType: "objective",
          },
          objectiveType: "goal",
          metricIds: ["gen-metric-1"],
        },
      ],
      conflicts: [],
    },
    compilationContext: {
      compilerVersion: "1.0.0",
      pipelineVersion: "1.0.0",
      compiledAt: "2026-01-01T00:00:00.000Z",
      sourceKnowledgeHash: "1".repeat(64),
      sourceKnowledgeCount: 3,
      sourceTypes: ["markdown"],
      sourceIds: ["int-1"],
      deterministicRunId: "bg-run-1",
    },
    diagnostics: [],
    metrics: {
      inputKnowledgeEntities: 2,
      inputKnowledgeFacts: 2,
      inputKnowledgeRelationships: 1,
      entitiesProjected: 2,
      relationshipsProjected: 1,
      capabilitiesExtracted: 1,
      processesExtracted: 1,
      policiesExtracted: 1,
      rulesExtracted: 1,
      rolesExtracted: 1,
      responsibilitiesMapped: 1,
      resourcesIdentified: 1,
      eventsIdentified: 1,
      workflowsConstructed: 1,
      constraintsIdentified: 1,
      metricsIdentified: 1,
      objectivesIdentified: 1,
      conflictsPreserved: 0,
      blockingConflicts: 0,
      diagnosticsCount: 0,
      executionTimeMs: 0,
    },
    deterministicHash: "a".repeat(64),
    deterministicSerialization: "{}",
    compiledFromKnowledgeHash: "1".repeat(64),
    generatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("blueprint compiler generates enterprise hierarchy deterministically", () => {
  const compiler = new BlueprintCompiler();
  const ir = compiler.compile(buildBusinessGenomeIR());

  assert.equal(ir.enterpriseBlueprint.domains.length > 0, true);
  assert.equal(ir.enterpriseBlueprint.boundedContexts.length > 0, true);
  assert.equal(ir.enterpriseBlueprint.modules.length > 0, true);
  assert.equal(ir.enterpriseBlueprint.services.length > 0, true);
});

test("blueprint compiler projects api and database models", () => {
  const compiler = new BlueprintCompiler();
  const ir = compiler.compile(buildBusinessGenomeIR());

  assert.equal(ir.enterpriseBlueprint.apis.length > 0, true);
  assert.equal(ir.enterpriseBlueprint.databases.length > 0, true);
  assert.equal(ir.enterpriseBlueprint.schemas.length > 0, true);
});

test("blueprint compiler projects workflows and events", () => {
  const compiler = new BlueprintCompiler();
  const ir = compiler.compile(buildBusinessGenomeIR());

  assert.equal(ir.enterpriseBlueprint.workflows.length > 0, true);
  assert.equal(ir.enterpriseBlueprint.events.length > 0, true);
});

test("blueprint compiler builds dependency graph and diagnostics", () => {
  const compiler = new BlueprintCompiler();
  const ir = compiler.compile(buildBusinessGenomeIR());

  assert.equal(ir.enterpriseBlueprint.dependencyGraph.nodes.length > 0, true);
  assert.equal(ir.enterpriseBlueprint.dependencyGraph.edges.length > 0, true);
  assert.equal(ir.metrics.dependencyNodeCount, ir.enterpriseBlueprint.dependencyGraph.nodes.length);
});

test("blueprint compiler preserves provenance and lineage", () => {
  const compiler = new BlueprintCompiler();
  const ir = compiler.compile(buildBusinessGenomeIR());

  assert.equal(Boolean(ir.enterpriseBlueprint.enterprise.provenance.sourceKnowledgeId), true);
  assert.equal(ir.enterpriseBlueprint.enterprise.lineage.transformationPath.includes("stage-5-blueprint-compiler"), true);
});

test("blueprint compiler output is immutable", () => {
  const compiler = new BlueprintCompiler();
  const ir = compiler.compile(buildBusinessGenomeIR());

  assert.equal(Object.isFrozen(ir), true);
  assert.equal(Object.isFrozen(ir.enterpriseBlueprint), true);
  assert.throws(() => {
    (ir.enterpriseBlueprint.modules as unknown as unknown[]).push({} as never);
  }, /object is not extensible|read only|frozen/i);
});

test("input-order determinism yields stable blueprint hash and serialization", () => {
  const compiler = new BlueprintCompiler();
  const base = buildBusinessGenomeIR();
  const reversed: BusinessGenomeIR = {
    ...base,
    businessGenome: {
      ...base.businessGenome,
      entities: [...base.businessGenome.entities].reverse(),
      capabilities: [...base.businessGenome.capabilities].reverse(),
      processes: [...base.businessGenome.processes].reverse(),
      events: [...base.businessGenome.events].reverse(),
      workflows: [...base.businessGenome.workflows].reverse(),
    },
  };

  const first = compiler.compile(base);
  const second = compiler.compile(reversed);

  assert.equal(first.deterministicHash, second.deterministicHash);
  assert.equal(first.deterministicSerialization, second.deterministicSerialization);
});
