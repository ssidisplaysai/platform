import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import { SemanticIdentityAssignmentPass } from "../../../src/compiler/genome/passes/SemanticIdentityAssignmentPass";
import type { ResolvedRelationshipCollection } from "../../../src/compiler/genome/pipeline-types";
import { deterministicIdentity } from "../../../src/compiler/genome/pipeline-types";
import type { CompilerPassContext } from "../../../src/compiler/core/types";

// Fixtures
const createMockConsolidatedSemanticCollection = () => ({
  id: "mock-cons-sem-coll-1",
  sourceEvidenceIrIdentity: "mock-evidence-ir-1",
  consolidatedSemantics: [
    {
      id: "bgc-cons-sem-1",
      semanticClass: "customer",
      designation: "Acme Corp",
      evidenceItemIds: ["ev-1", "ev-2", "ev-3"],
      provenanceReferences: ["prov-1", "prov-2"],
      lastUpdated: "2024-01-01T00:00:00Z",
    },
    {
      id: "bgc-cons-sem-2",
      semanticClass: "product",
      designation: "Enterprise Suite",
      evidenceItemIds: ["ev-4", "ev-5"],
      provenanceReferences: ["prov-3"],
      lastUpdated: "2024-01-01T00:00:00Z",
    },
  ],
  consolidationResults: [],
  diagnostics: [],
  passId: "bgc.semantic-consolidation",
  passVersion: "1.0.0",
  specificationVersion: "1.0.0",
  compilerVersion: "1.0.0",
  relationshipRuleVersion: "1.0.0",
  passHistory: [
    {
      passId: "bgc.input-validation",
      version: "1.0.0",
      status: "completed" as const,
      diagnosticCount: 0,
    },
  ],
});

const createMockResolvedRelationshipCollection = (): ResolvedRelationshipCollection => ({
  id: "mock-rel-coll-1",
  sourceEvidenceIrIdentity: "mock-evidence-ir-1",
  relationships: [
    {
      id: "bgc-rel-1",
      relationshipType: "CUSTOMER PURCHASED PRODUCT",
      sourceConsolidatedSemanticId: "bgc-cons-sem-1",
      targetConsolidatedSemanticId: "bgc-cons-sem-2",
      evidenceItemIds: ["ev-6", "ev-7"],
      provenanceReferences: ["prov-4"],
      strength: "strong",
      certainty: { state: "certain", confidence: 0.95 },
    },
  ],
  resolutionResults: [],
  diagnostics: [],
  passId: "bgc.relationship-resolution",
  passVersion: "1.0.0",
  specificationVersion: "1.0.0",
  compilerVersion: "1.0.0",
  relationshipRuleVersion: "1.0.0",
  passHistory: [
    {
      passId: "bgc.input-validation",
      version: "1.0.0",
      status: "completed" as const,
      diagnosticCount: 0,
    },
  ],
  consolidatedSemantics: createMockConsolidatedSemanticCollection(),
});

const createMockPassContext = (): CompilerPassContext => ({
  compilerVersion: "1.0.0",
  specificationVersion: "1.0.0",
  evidenceIrIdentity: "mock-evidence-ir-1",
});

describe("SemanticIdentityAssignmentPass (BGC-PASS-008)", () => {
  describe("Pass Contract", () => {
    test("Pass has correct metadata", () => {
      const pass = new SemanticIdentityAssignmentPass();
      assert.equal(pass.metadata.id, "bgc.identity-assignment");
      assert.equal(pass.metadata.version, "1.0.0");
      assert.deepEqual(pass.metadata.dependencies, ["bgc.relationship-resolution"]);
    });

    test("Pass is executable and returns result", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      assert.ok(result);
      assert.equal(typeof result.passId, "string");
      assert.equal(typeof result.passVersion, "string");
      assert.ok(Array.isArray(result.diagnostics));
      assert.equal(result.fatal, false);
    });

    test("Pass output implements BusinessGenomeIdentityCollection interface", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);
      const { output } = result;

      assert.ok(output);
      assert.equal(typeof output.id, "string");
      assert.equal(output.sourceEvidenceIrIdentity, input.sourceEvidenceIrIdentity);
      assert.ok(Array.isArray(output.semanticObjectIdentities));
      assert.ok(Array.isArray(output.relationshipIdentities));
      assert.ok(Array.isArray(output.assignmentResults));
      assert.ok(Array.isArray(output.diagnostics));
      assert.equal(output.passId, "bgc.identity-assignment");
      assert.equal(output.passVersion, "1.0.0");
    });
  });

  describe("Deterministic Identity Assignment", () => {
    test("Identical inputs produce identical identities", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result1 = pass.execute(input, context);
      const result2 = pass.execute(input, context);

      assert.equal(
        result1.output.semanticObjectIdentities[0]?.id,
        result2.output.semanticObjectIdentities[0]?.id,
      );
    });

    test("Assigns deterministic identities to semantic objects", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      assert.equal(result.output.semanticObjectIdentities.length, 2);
      for (const identity of result.output.semanticObjectIdentities) {
        assert.ok(identity.id.startsWith("bg.object_"));
        assert.equal(identity.kind, "semantic-object");
        assert.ok(identity.semanticClass);
        assert.ok(identity.sourceConsolidatedSemanticId);
      }
    });

    test("Assigns deterministic identities to relationships", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      assert.equal(result.output.relationshipIdentities.length, 1);
      for (const identity of result.output.relationshipIdentities) {
        assert.ok(identity.id.startsWith("bg.relationship_"));
        assert.equal(identity.kind, "semantic-relationship");
        assert.ok(identity.relationshipType);
        assert.ok(identity.sourceRelationshipId);
      }
    });

    test("Identity strings are immutable and repeatable", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const ids1: Set<string> = new Set();
      const ids2: Set<string> = new Set();

      for (let i = 0; i < 3; i++) {
        const result = pass.execute(input, context);
        for (const identity of result.output.semanticObjectIdentities) {
          ids1.add(identity.id);
        }
      }

      for (let i = 0; i < 3; i++) {
        const result = pass.execute(input, context);
        for (const identity of result.output.semanticObjectIdentities) {
          ids2.add(identity.id);
        }
      }

      assert.equal(ids1.size, ids2.size);
    });

    test("Identity assignments include correct context", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      for (const identity of result.output.semanticObjectIdentities) {
        assert.ok(identity.assignmentContext);
        assert.equal(identity.assignmentContext.passId, "bgc.identity-assignment");
        assert.equal(identity.assignmentContext.gps0001Version, "1.0.0");
      }
    });

    test("Different semantics produce different identities", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      const id1 = result.output.semanticObjectIdentities[0]?.id;
      const id2 = result.output.semanticObjectIdentities[1]?.id;

      assert.notEqual(id1, id2);
    });
  });

  describe("Provenance Preservation", () => {
    test("Identity captures all evidence lineage", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);
      const firstIdentity = result.output.semanticObjectIdentities[0];

      assert.ok(firstIdentity);
      assert.ok(Array.isArray(firstIdentity.evidenceLineage));
      assert.equal(firstIdentity.evidenceLineage.length, 3);
    });

    test("Identity preserves provenance references", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);
      const firstIdentity = result.output.semanticObjectIdentities[0];

      assert.ok(firstIdentity);
      assert.ok(Array.isArray(firstIdentity.provenanceReferences));
      assert.equal(firstIdentity.provenanceReferences.length, 2);
    });

    test("Identity tracks source evidence IR identity", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      for (const identity of result.output.semanticObjectIdentities) {
        assert.equal(identity.sourceEvidenceIrIdentity, input.sourceEvidenceIrIdentity);
      }
    });

    test("All identities maintain sorted evidence lineage for determinism", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      for (const identity of result.output.semanticObjectIdentities) {
        const sorted = [...identity.evidenceLineage].sort();
        assert.deepEqual(identity.evidenceLineage, sorted);
      }
    });
  });

  describe("Determinism Proofs", () => {
    test("Output collection ID is deterministic", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result1 = pass.execute(input, context);
      const result2 = pass.execute(input, context);

      assert.equal(result1.output.id, result2.output.id);
    });

    test("Identity assignment results are sorted deterministically", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);
      const ids = result.output.assignmentResults.map((r) => r.canonicalId);
      const sortedIds = [...ids].sort();

      assert.deepEqual(ids, sortedIds);
    });
  });

  describe("Assignment Rules", () => {
    test("Semantic object identities use semantic-object-assignment rule", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      for (const identity of result.output.semanticObjectIdentities) {
        assert.equal(
          identity.assignmentRuleId,
          "bgc.identity.rule.semantic-object-assignment",
        );
      }
    });

    test("Relationship identities use relationship-assignment rule", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      for (const identity of result.output.relationshipIdentities) {
        assert.equal(identity.assignmentRuleId, "bgc.identity.rule.relationship-assignment");
      }
    });
  });

  describe("Diagnostics", () => {
    test("Pass generates diagnostic for each assigned identity", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      assert.ok(result.diagnostics.length > 0);
      const assignmentDiagnostics = result.diagnostics.filter((d) => d.code === "BGC-ID-001");
      assert.equal(
        assignmentDiagnostics.length,
        result.output.semanticObjectIdentities.length + result.output.relationshipIdentities.length,
      );
    });

    test("Assignment result includes diagnostic per assignment", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      for (const assignmentResult of result.output.assignmentResults) {
        assert.ok(Array.isArray(assignmentResult.diagnostics));
        assert.ok(assignmentResult.diagnostics.length > 0);
      }
    });

    test("Diagnostics include appropriate details", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);
      const assignmentDiagnostics = result.diagnostics.filter((d) => d.code === "BGC-ID-001");

      for (const diagnostic of assignmentDiagnostics) {
        assert.ok(diagnostic.message.includes("identity") || diagnostic.message.includes("assigned"));
      }
    });
  });

  describe("Identity Certainty", () => {
    test("All assigned identities have certain state", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      for (const identity of [
        ...result.output.semanticObjectIdentities,
        ...result.output.relationshipIdentities,
      ]) {
        assert.equal(identity.certainty.state, "certain");
        assert.equal(identity.certainty.confidence, 1.0);
      }
    });

    test("All assigned identities pass validation", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      for (const identity of [
        ...result.output.semanticObjectIdentities,
        ...result.output.relationshipIdentities,
      ]) {
        assert.equal(identity.validationStatus.valid, true);
        assert.equal(identity.validationStatus.violations.length, 0);
      }
    });
  });

  describe("Pass History", () => {
    test("Output preserves pass history from input", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      assert.ok(result.output.passHistory.length > 0);
      const lastPass = result.output.passHistory[result.output.passHistory.length - 1];
      assert.equal(lastPass.passId, "bgc.identity-assignment");
      assert.equal(lastPass.status, "completed");
    });

    test("Pass history grows with each pass", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);
      const initialHistoryLength = input.passHistory.length;
      const outputHistoryLength = result.output.passHistory.length;

      assert.equal(outputHistoryLength, initialHistoryLength + 1);
    });
  });

  describe("Relationship Identity Mapping", () => {
    test("Relationship identities reference correct source and target", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      for (const relIdentity of result.output.relationshipIdentities) {
        assert.ok(relIdentity.sourceRelationshipId);
        // Verify the identity maps back to a resolved relationship
        const sourceRel = input.relationships.find((r) => r.id === relIdentity.sourceRelationshipId);
        assert.ok(sourceRel);
      }
    });
  });

  describe("No Graph Construction", () => {
    test("Pass does not construct semantic graph", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      // Pass should NOT create graph structures
      assert.ok(!("semanticGraph" in result.output));
      assert.ok(!("nodes" in result.output));
      assert.ok(!("edges" in result.output));
    });

    test("Pass preserves input collections without modification", () => {
      const pass = new SemanticIdentityAssignmentPass();
      const input = createMockResolvedRelationshipCollection();
      const context = createMockPassContext();

      const result = pass.execute(input, context);

      // Verify input collections are preserved in output
      assert.equal(result.output.resolvedRelationships, input);
    });
  });
});
