import { describe, test } from "node:test";
import assert from "node:assert";
import { GraphConstructionPass } from "../../../src/compiler/genome/passes/GraphConstructionPass";
import type {
  BusinessGenomeIdentityCollection,
  BusinessGenomeGraph,
} from "../../../src/compiler/genome/pipeline-types";

function createMockIdentityCollection(
  nodeIdentities: number = 2,
  edgeIdentities: number = 1,
): BusinessGenomeIdentityCollection {
  return {
    id: "bgc-id-coll-001",
    sourceEvidenceIrIdentity: "ev-ir-001",
    semanticObjectIdentities: Array.from({ length: nodeIdentities }, (_, i) => ({
      id: `bg.object_${i}_v1`,
      kind: "semantic-object" as const,
      semanticClass: i === 0 ? "customer" : "product",
      sourceConsolidatedSemanticId: `bgc-cse_${i}_v1`,
      assignedAt: "2024-01-01T00:00:00Z",
      assignmentRuleId: "bgc.identity.rule.semantic-object-assignment",
      assignmentRuleVersion: "1.0.0",
      assignmentVersion: "1.0.0",
      evidenceLineage: [`ev-${i}-001`, `ev-${i}-002`],
      provenanceReferences: [`prov-${i}-001`],
      sourceEvidenceIrIdentity: "ev-ir-001",
      certainty: { state: "certain" as const, confidence: 1.0 },
      validationStatus: { valid: true, violations: [] },
      assignmentContext: {
        passId: "bgc.identity-assignment",
        passVersion: "1.0.0",
        compilerVersion: "1.0.0",
        specificationVersion: "1.0.0",
        ruleId: "bgc.identity.rule.semantic-object-assignment",
        ruleVersion: "1.0.0",
        rationaleCode: "BGC-RATIONALE-IDENTITY-001",
        gps0001Version: "1.0.0",
        gps0002Version: "1.0.0",
      },
      diagnostics: [],
    })),
    relationshipIdentities: Array.from({ length: edgeIdentities }, (_, i) => ({
      id: `bg.relationship_${i}_v1`,
      kind: "semantic-relationship" as const,
      relationshipType: "PURCHASED",
      sourceConsolidatedSemanticId: `bgc-cse_0_v1`,
      sourceRelationshipId: `bgc-rel_${i}_v1`,
      assignedAt: "2024-01-01T00:00:00Z",
      assignmentRuleId: "bgc.identity.rule.relationship-assignment",
      assignmentRuleVersion: "1.0.0",
      assignmentVersion: "1.0.0",
      evidenceLineage: [`ev-rel-${i}-001`],
      provenanceReferences: [`prov-rel-${i}-001`],
      sourceEvidenceIrIdentity: "ev-ir-001",
      certainty: { state: "certain" as const, confidence: 1.0 },
      validationStatus: { valid: true, violations: [] },
      assignmentContext: {
        passId: "bgc.identity-assignment",
        passVersion: "1.0.0",
        compilerVersion: "1.0.0",
        specificationVersion: "1.0.0",
        ruleId: "bgc.identity.rule.relationship-assignment",
        ruleVersion: "1.0.0",
        rationaleCode: "BGC-RATIONALE-IDENTITY-002",
        gps0001Version: "1.0.0",
        gps0002Version: "1.0.0",
      },
      diagnostics: [],
    })),
    assignmentResults: [],
    diagnostics: [],
    passId: "bgc.identity-assignment",
    passVersion: "1.0.0",
    specificationVersion: "1.0.0",
    compilerVersion: "1.0.0",
    identityAssignmentVersion: "1.0.0",
    passHistory: [],
    resolvedRelationships: {
      id: "bgc-rel-coll-001",
      sourceEvidenceIrIdentity: "ev-ir-001",
      relationships: Array.from({ length: edgeIdentities }, (_, i) => ({
        id: `bgc-rel_${i}_v1`,
        relationshipType: "PURCHASED",
        sourceConsolidatedSemanticId: `bgc-cse_0_v1`,
        targetConsolidatedSemanticId: `bgc-cse_1_v1`,
        sourceSemanticClass: "customer",
        targetSemanticClass: "product",
        resolutionRuleId: "rule-001",
        resolutionRuleVersion: "1.0.0",
        evidenceClusterIds: [],
        evidenceGroupIds: [],
        evidenceItemIds: [`ev-rel-${i}-001`],
        provenanceReferences: [`prov-rel-${i}-001`],
        sourceEvidenceIrIdentity: "ev-ir-001",
        certainty: { state: "certain" as const, confidence: 1.0 },
        conflictReferences: [],
        validationStatus: { valid: true, violations: [] },
        resolutionContext: {
          passId: "bgc.relationship-resolution",
          passVersion: "1.0.0",
          compilerVersion: "1.0.0",
          specificationVersion: "1.0.0",
          ruleId: "rule-001",
          ruleVersion: "1.0.0",
          rationaleCode: "BGC-RATIONALE-REL-001",
        },
        diagnostics: [],
      })),
      resolutionResults: [],
      diagnostics: [],
      passId: "bgc.relationship-resolution",
      passVersion: "1.0.0",
      specificationVersion: "1.0.0",
      compilerVersion: "1.0.0",
      relationshipRuleVersion: "1.0.0",
      passHistory: [],
      consolidatedSemantics: {
        id: "bgc-cse-coll-001",
        sourceEvidenceIrIdentity: "ev-ir-001",
        consolidatedSemantics: Array.from({ length: nodeIdentities }, (_, i) => ({
          id: `bgc-cse_${i}_v1`,
          semanticClass: i === 0 ? "customer" : "product",
          designation: i === 0 ? "Acme Corp" : "Enterprise Suite",
          canonicalDesignation: i === 0 ? "Acme Corp" : "Enterprise Suite",
          assertions: [],
          contributingCandidates: [],
          mergedCandidateCount: 1,
          evidenceClusterIds: [],
          evidenceGroupIds: [],
          evidenceItemIds: [`ev-${i}-001`],
          provenanceReferences: [`prov-${i}-001`],
          sourceEvidenceIrIdentity: "ev-ir-001",
          conflictReferences: [],
          hasConflicts: false,
          consolidationRuleId: "rule-001",
          consolidationRuleVersion: "1.0.0",
          certainty: { state: "certain" as const, confidence: 1.0 },
          validationStatus: { valid: true, violations: [] },
          consolidationContext: {
            passId: "bgc.semantic-consolidation",
            passVersion: "1.0.0",
            compilerVersion: "1.0.0",
            specificationVersion: "1.0.0",
            ruleId: "rule-001",
            ruleVersion: "1.0.0",
            rationaleCode: "BGC-RATIONALE-CONS-001",
          },
          diagnostics: [],
        })),
        mergeResults: [],
        diagnostics: [],
        passId: "bgc.semantic-consolidation",
        passVersion: "1.0.0",
        specificationVersion: "1.0.0",
        compilerVersion: "1.0.0",
        consolidationRuleVersion: "1.0.0",
        passHistory: [],
      },
    },
  } as unknown as BusinessGenomeIdentityCollection;
}

describe("GraphConstructionPass (BGC-PASS-009)", () => {
  describe("Pass Contract", () => {
    test("Pass has correct metadata", () => {
      const pass = new GraphConstructionPass();
      assert.equal(pass.metadata.id, "bgc.graph-construction");
      assert.equal(pass.metadata.version, "1.0.0");
      assert.deepEqual(pass.metadata.dependencies, ["bgc.identity-assignment"]);
      assert.equal(pass.metadata.inputType, "business-genome-identity-collection");
      assert.equal(pass.metadata.outputType, "business-genome-graph");
      assert.equal(pass.metadata.lifecycle, "active");
    });

    test("Pass is executable and returns result", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection();
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      assert(result);
      assert.equal(result.passId, "bgc.graph-construction");
      assert.equal(result.passVersion, "1.0.0");
    });

    test("Pass output implements BusinessGenomeGraph interface", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection();
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;
      assert(graph.nodes);
      assert(graph.edges);
      assert(Array.isArray(graph.nodes));
      assert(Array.isArray(graph.edges));
    });
  });

  describe("Deterministic Graph Construction", () => {
    test("Identical inputs produce identical graphs", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(2, 1);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };

      const result1 = pass.execute(input, context);
      const result2 = pass.execute(input, context);

      const graph1 = result1.output as BusinessGenomeGraph;
      const graph2 = result2.output as BusinessGenomeGraph;

      assert.equal(graph1.id, graph2.id);
      assert.equal(JSON.stringify(graph1.nodes), JSON.stringify(graph2.nodes));
      assert.equal(JSON.stringify(graph1.edges), JSON.stringify(graph2.edges));
    });

    test("Nodes are constructed for each semantic object identity", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(3, 2);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;
      assert.equal(graph.nodes.length, 3);
    });

    test("Edges are constructed for each relationship identity", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(2, 3);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;
      assert.equal(graph.edges.length, 3);
    });

    test("Graph IDs are deterministic based on content", () => {
      const pass = new GraphConstructionPass();
      const input1 = createMockIdentityCollection(2, 1);
      const input2 = createMockIdentityCollection(2, 1);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };

      const result1 = pass.execute(input1, context);
      const result2 = pass.execute(input2, context);

      assert.equal(result1.output.id, result2.output.id);
    });
  });

  describe("Node Ordering", () => {
    test("Nodes are sorted deterministically by ID", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(5, 0);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;

      const nodeIds = graph.nodes.map((n) => n.id);
      const sortedNodeIds = [...nodeIds].sort();
      assert.deepEqual(nodeIds, sortedNodeIds);
    });

    test("Node ordering is stable across runs", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(5, 0);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };

      const result1 = pass.execute(input, context);
      const result2 = pass.execute(input, context);

      const nodeIds1 = (result1.output as BusinessGenomeGraph).nodes.map((n) => n.id);
      const nodeIds2 = (result2.output as BusinessGenomeGraph).nodes.map((n) => n.id);

      assert.deepEqual(nodeIds1, nodeIds2);
    });
  });

  describe("Edge Ordering", () => {
    test("Edges are sorted deterministically by ID", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(2, 5);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;

      const edgeIds = graph.edges.map((e) => e.id);
      const sortedEdgeIds = [...edgeIds].sort();
      assert.deepEqual(edgeIds, sortedEdgeIds);
    });

    test("Edge ordering is stable across runs", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(2, 5);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };

      const result1 = pass.execute(input, context);
      const result2 = pass.execute(input, context);

      const edgeIds1 = (result1.output as BusinessGenomeGraph).edges.map((e) => e.id);
      const edgeIds2 = (result2.output as BusinessGenomeGraph).edges.map((e) => e.id);

      assert.deepEqual(edgeIds1, edgeIds2);
    });
  });

  describe("Provenance Preservation", () => {
    test("Node provenance is preserved from identity", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(1, 0);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;
      const node = graph.nodes[0];

      assert(node.provenanceReferences);
      assert(node.provenanceReferences.length > 0);
    });

    test("Edge provenance is preserved from identity", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(2, 1);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;
      const edge = graph.edges[0];

      assert(edge.provenanceReferences);
      assert(edge.provenanceReferences.length > 0);
    });

    test("Evidence lineage is preserved and sorted", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(1, 0);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;
      const node = graph.nodes[0];

      const lineage = node.evidenceLineage;
      const sortedLineage = [...lineage].sort();
      assert.deepEqual(lineage, sortedLineage);
    });
  });

  describe("Immutability", () => {
    test("Graph nodes are immutable after construction", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(1, 0);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;
      const node = graph.nodes[0];

      assert.throws(() => {
        const mutableNode = node as { id: string };
        mutableNode.id = "modified";
      });
    });

    test("Graph edges are immutable after construction", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(2, 1);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;
      const edge = graph.edges[0];

      assert.throws(() => {
        const mutableEdge = edge as { relationshipType: string };
        mutableEdge.relationshipType = "modified";
      });
    });
  });

  describe("No Synthesized Nodes or Edges", () => {
    test("Graph has no extra nodes beyond identities", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(5, 0);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;

      assert.equal(graph.nodes.length, 5);
    });

    test("Graph has no extra edges beyond identities", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(2, 10);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;

      assert.equal(graph.edges.length, 10);
    });
  });

  describe("Deterministic Serialization", () => {
    test("Graph JSON serialization is deterministic", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(3, 2);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };

      const result1 = pass.execute(input, context);
      const result2 = pass.execute(input, context);

      const json1 = JSON.stringify(result1.output);
      const json2 = JSON.stringify(result2.output);

      assert.equal(json1, json2);
    });
  });

  describe("Diagnostics", () => {
    test("Pass generates construction diagnostics", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(1, 1);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);

      assert(result.diagnostics);
      assert(result.diagnostics.length > 0);
    });

    test("Diagnostics include node construction events", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(1, 0);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);

      const nodeConstructionDiags = result.diagnostics.filter((d) => d.code === "BGC-GRAPH-001");
      assert(nodeConstructionDiags.length > 0);
    });

    test("Diagnostics include edge construction events", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(2, 1);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);

      const edgeConstructionDiags = result.diagnostics.filter((d) => d.code === "BGC-GRAPH-003");
      assert(edgeConstructionDiags.length > 0);
    });
  });

  describe("Business Genome Not Published", () => {
    test("Graph output is not a published artifact", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(2, 1);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);
      const graph = result.output as BusinessGenomeGraph;

      // Graph should not have an artifact ID or publication status
      assert(!("publishedAt" in graph));
      assert(!("manifestReference" in graph) || graph.businessGenomeIdentityCollection !== undefined);
    });

    test("Graph is intermediate, not final Business Genome", () => {
      const pass = new GraphConstructionPass();
      const input = createMockIdentityCollection(2, 1);
      const context = { sessionId: "session-1", pipelineVersion: "1.0.0" };
      const result = pass.execute(input, context);

      // Status should not indicate publication
      assert(!result.fatal || result.fatal === false);
    });
  });
});
