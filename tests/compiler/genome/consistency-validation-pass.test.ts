import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { ConsistencyValidationPass } from "../../../src/compiler/genome/passes/ConsistencyValidationPass";
import type {
  BusinessGenomeGraph,
  BusinessGenomeNode,
  BusinessGenomeEdge,
  BusinessGenomeValidationResult,
} from "../../../src/compiler/genome/pipeline-types";

/**
 * M1.9 Consistency Validation Test Suite
 *
 * Tests validate non-modifying graph validation with 12+ validation invariants.
 * All tests prove that the validator detects violations without modifying the graph.
 */

function createMockNode(
  id: string,
  overrides?: Partial<BusinessGenomeNode>,
): BusinessGenomeNode {
  return {
    id,
    semanticClass: "actor",
    canonicalDesignation: `node-${id}`,
    sourceIdentityId: `identity_${id}`,
    sourceConsolidatedSemanticId: `semantic_${id}`,
    provenanceReferences: [`evidence_${id}`],
    evidenceLineage: [`lineage_${id}`],
    sourceEvidenceIrIdentity: "ir_001",
    constructedAt: "2024-01-01T00:00:00Z",
    certainty: { state: "certain" as const, confidence: 1.0 },
    validationStatus: { valid: true, violations: [] },
    graphConstructionContext: {
      passId: "bgc.graph-construction",
      passVersion: "1.0.0",
      compilerVersion: "1.0.0",
      specificationVersion: "1.0.0",
      ruleId: "bgc.graph.rule.node-construction",
      ruleVersion: "1.0.0",
      rationaleCode: "BGC-RATIONALE-GRAPH-001",
      gps0001Version: "1.0.0",
      gps0002Version: "1.0.0",
    },
    diagnostics: [],
    ...overrides,
  };
}

function createMockEdge(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  overrides?: Partial<BusinessGenomeEdge>,
): BusinessGenomeEdge {
  return {
    id,
    relationshipType: "OWNS",
    sourceNodeId,
    targetNodeId,
    sourceIdentityId: `identity_${id}`,
    sourceRelationshipId: `rel_${id}`,
    provenanceReferences: [`evidence_${id}`],
    evidenceLineage: [`lineage_${id}`],
    sourceEvidenceIrIdentity: "ir_001",
    constructedAt: "2024-01-01T00:00:00Z",
    certainty: { state: "certain" as const, confidence: 1.0 },
    validationStatus: { valid: true, violations: [] },
    graphConstructionContext: {
      passId: "bgc.graph-construction",
      passVersion: "1.0.0",
      compilerVersion: "1.0.0",
      specificationVersion: "1.0.0",
      ruleId: "bgc.graph.rule.edge-construction",
      ruleVersion: "1.0.0",
      rationaleCode: "BGC-RATIONALE-GRAPH-002",
      gps0001Version: "1.0.0",
      gps0002Version: "1.0.0",
    },
    diagnostics: [],
    ...overrides,
  };
}

function createMockGraph(
  nodes: BusinessGenomeNode[],
  edges: BusinessGenomeEdge[],
  overrides?: Partial<BusinessGenomeGraph>,
): BusinessGenomeGraph {
  const sortedNodes = nodes.sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = edges.sort((a, b) => a.id.localeCompare(b.id));
  const graphId = `bg.graph_${sortedNodes.length}_${sortedEdges.length}_v1`;

  return {
    id: graphId,
    sourceEvidenceIrIdentity: "ir_001",
    nodes: sortedNodes,
    edges: sortedEdges,
    nodeConstructionResults: sortedNodes.map((n) => ({
      canonicalNodeId: n.id,
      sourceIdentityId: n.sourceIdentityId,
      constructed: true,
      constructionRuleId: "bgc.graph.rule.node-construction",
      constructionRuleVersion: "1.0.0",
      diagnostics: [],
    })),
    edgeConstructionResults: sortedEdges.map((e) => ({
      canonicalEdgeId: e.id,
      sourceIdentityId: e.sourceIdentityId,
      constructed: true,
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
      constructionRuleId: "bgc.graph.rule.edge-construction",
      constructionRuleVersion: "1.0.0",
      diagnostics: [],
    })),
    diagnostics: [],
    passId: "bgc.graph-construction",
    passVersion: "1.0.0",
    specificationVersion: "1.0.0",
    compilerVersion: "1.0.0",
    graphConstructionVersion: "1.0.0",
    passHistory: [],
    businessGenomeIdentityCollection: {
      sourceEvidenceIrIdentity: "ir_001",
      semanticObjectIdentities: [],
      relationshipIdentities: [],
      resolvedRelationships: {
        relationships: [],
        consolidatedSemantics: {
          id: "cons_001",
          sourceEvidenceIrIdentity: "ir_001",
          consolidatedSemantics: [],
          mergeResults: [],
          diagnostics: [],
          passId: "bgc.semantic-consolidation",
          passVersion: "1.0.0",
          specificationVersion: "1.0.0",
          compilerVersion: "1.0.0",
          consolidationRuleVersion: "1.0.0",
          passHistory: [],
          semanticCandidates: {
            id: "cand_001",
            sourceEvidenceIrIdentity: "ir_001",
            candidates: [],
            resolutionResults: [],
            diagnostics: [],
            passId: "bgc.semantic-resolution",
            passVersion: "1.0.0",
            specificationVersion: "1.0.0",
            compilerVersion: "1.0.0",
            passHistory: [],
            correlatedEvidence: {
              sourceEvidenceIrIdentity: "ir_001",
              clusters: [],
              diagnostics: [],
              passId: "bgc.evidence-correlation",
              passVersion: "1.0.0",
              specificationVersion: "1.0.0",
              compilerVersion: "1.0.0",
              correlationRuleVersion: "1.0.0",
              passHistory: [],
              groupedEvidence: {
                sourceEvidenceIrIdentity: "ir_001",
                groups: [],
                diagnostics: [],
                passId: "bgc.evidence-grouping",
                passVersion: "1.0.0",
                specificationVersion: "1.0.0",
                compilerVersion: "1.0.0",
                groupingRuleVersion: "1.0.0",
                passHistory: [],
              },
            },
          } as any,
        } as any,
      },
      passId: "bgc.identity-assignment",
      passVersion: "1.0.0",
      specificationVersion: "1.0.0",
      compilerVersion: "1.0.0",
      diagnostics: [],
      passHistory: [],
    } as any,
    ...overrides,
  };
}

describe("ConsistencyValidationPass (M1.9)", () => {
  const pass = new ConsistencyValidationPass();

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Pass Contract Validation
  // ──────────────────────────────────────────────────────────────────────────

  describe("Pass Contract", () => {
    it("should have correct metadata", () => {
      assert.equal(pass.metadata.id, "bgc.consistency-validation");
      assert.equal(pass.metadata.version, "1.0.0");
      assert.deepEqual(pass.metadata.dependencies, ["bgc.graph-construction"]);
      assert(pass.metadata.capabilities.includes("validation"));
      assert(pass.metadata.capabilities.includes("non-modifying"));
    });

    it("should be executable", () => {
      assert.equal(typeof pass.execute, "function");
    });

    it("should return BusinessGenomeValidationResult", () => {
      const nodes = [createMockNode("n1")];
      const edges: BusinessGenomeEdge[] = [];
      const graph = createMockGraph(nodes, edges);

      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      assert(result && typeof result === "object");
      assert(result.output);
      assert.equal(result.output.graphId, graph.id);
      assert(["valid", "invalid", "valid-with-warnings"].includes(result.output.validationStatus));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Duplicate Node Detection
  // ──────────────────────────────────────────────────────────────────────────

  describe("Duplicate Node Identities", () => {
    it("should detect duplicate node IDs", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n1"); // Duplicate ID

      const graph = createMockGraph([node1, node2], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const duplicateViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-001",
      );
      assert(duplicateViolations.length > 0);
      assert.equal(result.output.validationStatus, "invalid");
    });

    it("should not detect duplicates for unique nodes", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");

      const graph = createMockGraph([node1, node2], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const duplicateViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-001",
      );
      assert.equal(duplicateViolations.length, 0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Duplicate Edge Detection
  // ──────────────────────────────────────────────────────────────────────────

  describe("Duplicate Edge Identities", () => {
    it("should detect duplicate edge IDs", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");
      const edge1 = createMockEdge("e1", "n1", "n2");
      const edge2 = createMockEdge("e1", "n1", "n2"); // Duplicate ID

      const graph = createMockGraph([node1, node2], [edge1, edge2]);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const duplicateViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-002",
      );
      assert(duplicateViolations.length > 0);
      assert.equal(result.output.validationStatus, "invalid");
    });

    it("should not detect duplicates for unique edges", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");
      const edge1 = createMockEdge("e1", "n1", "n2");
      const edge2 = createMockEdge("e2", "n2", "n1");

      const graph = createMockGraph([node1, node2], [edge1, edge2]);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const duplicateViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-002",
      );
      assert.equal(duplicateViolations.length, 0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Orphan Source Node Detection
  // ──────────────────────────────────────────────────────────────────────────

  describe("Orphan Source Node Detection", () => {
    it("should detect edge with missing source node", () => {
      const node1 = createMockNode("n1");
      const edge = createMockEdge("e1", "n_missing", "n1");

      const graph = createMockGraph([node1], [edge]);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const orphanViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-003",
      );
      assert(orphanViolations.length > 0);
      assert.equal(result.output.validationStatus, "invalid");
    });

    it("should not flag edges with valid source nodes", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");
      const edge = createMockEdge("e1", "n1", "n2");

      const graph = createMockGraph([node1, node2], [edge]);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const orphanViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-003",
      );
      assert.equal(orphanViolations.length, 0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Orphan Target Node Detection
  // ──────────────────────────────────────────────────────────────────────────

  describe("Orphan Target Node Detection", () => {
    it("should detect edge with missing target node", () => {
      const node1 = createMockNode("n1");
      const edge = createMockEdge("e1", "n1", "n_missing");

      const graph = createMockGraph([node1], [edge]);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const orphanViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-004",
      );
      assert(orphanViolations.length > 0);
      assert.equal(result.output.validationStatus, "invalid");
    });

    it("should not flag edges with valid target nodes", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");
      const edge = createMockEdge("e1", "n1", "n2");

      const graph = createMockGraph([node1, node2], [edge]);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const orphanViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-004",
      );
      assert.equal(orphanViolations.length, 0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Provenance Validation
  // ──────────────────────────────────────────────────────────────────────────

  describe("Node Provenance Validation", () => {
    it("should detect node missing provenance", () => {
      const node = createMockNode("n1", { provenanceReferences: [] });
      const graph = createMockGraph([node], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const provenanceViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-005",
      );
      assert(provenanceViolations.length > 0);
    });

    it("should not flag nodes with provenance", () => {
      const node = createMockNode("n1");
      const graph = createMockGraph([node], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const provenanceViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-005",
      );
      assert.equal(provenanceViolations.length, 0);
    });
  });

  describe("Edge Provenance Validation", () => {
    it("should detect edge missing provenance", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");
      const edge = createMockEdge("e1", "n1", "n2", { provenanceReferences: [] });

      const graph = createMockGraph([node1, node2], [edge]);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const provenanceViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-006",
      );
      assert(provenanceViolations.length > 0);
    });

    it("should not flag edges with provenance", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");
      const edge = createMockEdge("e1", "n1", "n2");

      const graph = createMockGraph([node1, node2], [edge]);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const provenanceViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-006",
      );
      assert.equal(provenanceViolations.length, 0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Lineage Validation
  // ──────────────────────────────────────────────────────────────────────────

  describe("Lineage Preservation Validation", () => {
    it("should warn when node has no evidence lineage", () => {
      const node = createMockNode("n1", { evidenceLineage: [] });
      const graph = createMockGraph([node], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const lineageViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-007",
      );
      assert(lineageViolations.length > 0);
      assert.equal(lineageViolations[0].violationSeverity, "warning");
    });

    it("should accept nodes with lineage", () => {
      const node = createMockNode("n1");
      const graph = createMockGraph([node], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const lineageViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-007",
      );
      assert.equal(lineageViolations.length, 0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Deterministic Ordering Validation
  // ──────────────────────────────────────────────────────────────────────────

  describe("Deterministic Ordering Validation", () => {
    it("should detect unsorted nodes", () => {
      const node1 = createMockNode("n2");
      const node2 = createMockNode("n1");
      // Unsorted (n2, n1 instead of n1, n2)
      const graph = createMockGraph([node1, node2], [], { nodes: [node1, node2] });
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const orderViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-008",
      );
      assert(orderViolations.length > 0);
    });

    it("should accept sorted nodes", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");
      const graph = createMockGraph([node1, node2], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const orderViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-008",
      );
      assert.equal(orderViolations.length, 0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Graph Identity Reproducibility
  // ──────────────────────────────────────────────────────────────────────────

  describe("Graph Identity Reproducibility", () => {
    it("should detect graph with incorrect identity", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");
      const graph = createMockGraph([node1, node2], [], { id: "invalid_id" });
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const identityViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-009",
      );
      assert(identityViolations.length > 0);
    });

    it("should accept correct graph identity", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");
      const graph = createMockGraph([node1, node2], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const identityViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-009",
      );
      assert.equal(identityViolations.length, 0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Compiler Metadata Validation
  // ──────────────────────────────────────────────────────────────────────────

  describe("Compiler Metadata Validation", () => {
    it("should detect missing compiler metadata", () => {
      const node1 = createMockNode("n1");
      const graph = createMockGraph([node1], [], { passId: "" });
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const metadataViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-010",
      );
      assert(metadataViolations.length > 0);
    });

    it("should accept complete metadata", () => {
      const node1 = createMockNode("n1");
      const graph = createMockGraph([node1], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const metadataViolations = result.output.violations.filter(
        (v) => v.violationCode === "BGC-VALID-010",
      );
      assert.equal(metadataViolations.length, 0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. Graph Immutability
  // ──────────────────────────────────────────────────────────────────────────

  describe("Graph Immutability", () => {
    it("should not modify the input graph", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");
      const edge = createMockEdge("e1", "n1", "n2");
      const graph = createMockGraph([node1, node2], [edge]);

      const originalNodesCount = graph.nodes.length;
      const originalEdgesCount = graph.edges.length;
      const originalId = graph.id;

      pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      assert.equal(graph.nodes.length, originalNodesCount);
      assert.equal(graph.edges.length, originalEdgesCount);
      assert.equal(graph.id, originalId);
    });

    it("should return original graph in validation result", () => {
      const node1 = createMockNode("n1");
      const graph = createMockGraph([node1], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      assert.equal(result.output.businessGenomeGraph.id, graph.id);
      assert.equal(result.output.businessGenomeGraph.nodes.length, graph.nodes.length);
      assert.equal(result.output.businessGenomeGraph.edges.length, graph.edges.length);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 12. Business Genome Not Published
  // ──────────────────────────────────────────────────────────────────────────

  describe("Business Genome Not Published", () => {
    it("should not publish Business Genome", () => {
      const node1 = createMockNode("n1");
      const graph = createMockGraph([node1], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      // Validation status should be intermediate, not published
      assert(["valid", "invalid", "valid-with-warnings"].includes(result.output.validationStatus));
      // No publication marker should exist
      assert(!result.output.validationStatus.includes("published"));
    });

    it("should preserve validation status in intermediate state", () => {
      const node1 = createMockNode("n1");
      const graph = createMockGraph([node1], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      // Should be a validation result, not a published genome
      assert.equal(result.output.passId, "bgc.consistency-validation");
      assert(result.output.diagnostics instanceof Array);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 13. Repeat Execution Equivalence
  // ──────────────────────────────────────────────────────────────────────────

  describe("Repeat Execution Equivalence", () => {
    it("should produce identical results for repeated execution", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");
      const graph = createMockGraph([node1, node2], []);

      const result1 = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });
      const result2 = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      assert.equal(result1.output.validationStatus, result2.output.validationStatus);
      assert.equal(result1.output.violations.length, result2.output.violations.length);
      assert.equal(
        result1.output.validationHistoryChecksum,
        result2.output.validationHistoryChecksum,
      );
    });

    it("should produce deterministic diagnostics", () => {
      const node1 = createMockNode("n1", { provenanceReferences: [] }); // Missing provenance
      const graph = createMockGraph([node1], []);

      const result1 = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });
      const result2 = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      const diagnostics1 = result1.output.diagnostics.map((d) => d.code).sort();
      const diagnostics2 = result2.output.diagnostics.map((d) => d.code).sort();

      assert.deepEqual(diagnostics1, diagnostics2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 14. Validation Summary Statistics
  // ──────────────────────────────────────────────────────────────────────────

  describe("Validation Summary", () => {
    it("should compute correct summary statistics for valid graph", () => {
      const node1 = createMockNode("n1");
      const node2 = createMockNode("n2");
      const graph = createMockGraph([node1, node2], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      assert.equal(result.output.summary.validationStatus, "passed");
      assert.equal(result.output.summary.invariantsFailed, 0);
      assert.equal(result.output.summary.violationCount, 0);
    });

    it("should compute correct summary statistics for invalid graph", () => {
      const node1 = createMockNode("n1", { provenanceReferences: [] });
      const graph = createMockGraph([node1], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      assert(result.output.summary.violationCount > 0);
      assert(result.output.summary.errorViolations > 0);
    });

    it("should sort diagnostics deterministically", () => {
      const node1 = createMockNode("n1", { provenanceReferences: [] });
      const node2 = createMockNode("n2", { evidenceLineage: [] });
      const graph = createMockGraph([node1, node2], []);
      const result = pass.execute(graph, { sessionId: "test", pipelineVersion: "1.0.0" });

      for (let i = 1; i < result.output.diagnostics.length; i++) {
        const prev = result.output.diagnostics[i - 1].code;
        const curr = result.output.diagnostics[i].code;
        assert(prev.localeCompare(curr) <= 0, `Diagnostics not sorted: ${prev} > ${curr}`);
      }
    });
  });
});
