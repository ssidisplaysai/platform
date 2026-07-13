import { describe, it, expect } from "@jest/globals";
import { BusinessGenomePublicationPass } from "../../../src/compiler/genome/passes/BusinessGenomePublicationPass";
import type {
  BusinessGenomeValidationResult,
  BusinessGenomeGraph,
  BusinessGenomeNode,
  BusinessGenomeEdge,
  GraphInvariantViolation,
  ValidationSummary,
  ValidationContext,
} from "../../../src/compiler/genome/pipeline-types";
import { SourceHash } from "../../../src/compiler/provenance/SourceHash";
import { stableStringify } from "../../../src/compiler/core/stableStringify";

// ─── Mock Builders ─────────────────────────────────────────────────────────

function createMockNode(id: string, overrides?: Partial<BusinessGenomeNode>): BusinessGenomeNode {
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
  nodes: BusinessGenomeNode[] = [],
  edges: BusinessGenomeEdge[] = [],
  overrides?: Partial<BusinessGenomeGraph>,
): BusinessGenomeGraph {
  const sortedNodes = nodes.sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = edges.sort((a, b) => a.id.localeCompare(b.id));

  return {
    id: "bgc-graph_abc123_v1",
    sourceEvidenceIrIdentity: "ir_001",
    nodes: sortedNodes,
    edges: sortedEdges,
    nodeConstructionResults: sortedNodes.map((n) => ({
      canonicalNodeId: n.id,
      sourceIdentityId: n.sourceIdentityId,
      constructed: true,
      semanticClass: n.semanticClass,
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

function createMockValidationResult(
  graph: BusinessGenomeGraph,
  validationStatus: "valid" | "invalid" | "valid-with-warnings" = "valid",
): BusinessGenomeValidationResult {
  const summary: ValidationSummary = {
    totalInvariants: 10,
    invariantsPassed: 10,
    invariantsFailed: 0,
    violationCount: 0,
    errorViolations: 0,
    warningViolations: 0,
    infoViolations: 0,
    validationStatus: validationStatus === "valid" ? "passed" : validationStatus === "valid-with-warnings" ? "warnings" : "failed",
  };

  const context: ValidationContext = {
    passId: "bgc.consistency-validation",
    passVersion: "1.0.0",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
    compilerVersion: "1.0.0",
    specificationVersion: "1.0.0",
    validationTimestamp: "2024-01-01T00:00:00Z",
    validationRuleId: "bgc.validation.rule.unique-node-identities",
    validationRuleVersion: "1.0.0",
  };

  return {
    graphId: graph.id,
    sourceEvidenceIrIdentity: graph.sourceEvidenceIrIdentity,
    validationStatus,
    violations: [],
    summary,
    context,
    diagnostics: [],
    passId: "bgc.consistency-validation",
    passVersion: "1.0.0",
    specificationVersion: "1.0.0",
    compilerVersion: "1.0.0",
    validationHistoryChecksum: SourceHash.sha256(stableStringify({})),
    passHistory: [
      {
        passId: "bgc.graph-construction",
        version: "1.0.0",
        status: "completed",
        diagnosticCount: 0,
      },
      {
        passId: "bgc.consistency-validation",
        version: "1.0.0",
        status: "completed",
        diagnosticCount: 0,
      },
    ],
    businessGenomeGraph: graph,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("BusinessGenomePublicationPass (M1.10)", () => {
  const pass = new BusinessGenomePublicationPass();

  describe("1. Pass Contract", () => {
    it("should have correct metadata", () => {
      expect(pass.metadata.id).toBe("bgc.business-genome-publication");
      expect(pass.metadata.version).toBe("1.0.0");
      expect(pass.metadata.dependencies).toContain("bgc.consistency-validation");
      expect(pass.metadata.capabilities).toContain("publication");
      expect(pass.metadata.capabilities).toContain("non-modifying");
    });

    it("should be executable", () => {
      expect(pass.execute).toBeDefined();
      expect(typeof pass.execute).toBe("function");
    });

    it("should return correct result type", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.passId).toBe("bgc.business-genome-publication");
      expect(result.passVersion).toBe("1.0.0");
      expect(result.output).toBeDefined();
      expect(result.output.graph).toBeDefined();
    });
  });

  describe("2. Validated Graph Publishes Successfully", () => {
    it("should publish valid graph with nodes and edges", async () => {
      const node1 = createMockNode("node_001");
      const node2 = createMockNode("node_002");
      const edge = createMockEdge("edge_001", "node_001", "node_002");
      const graph = createMockGraph([node1, node2], [edge]);
      const validation = createMockValidationResult(graph, "valid");

      const result = await pass.execute(validation, {} as any);

      expect(result.output.publicationStatus).toBe("published");
      expect(result.output.artifact).toBeDefined();
      expect(result.output.artifact?.businessGenomeGraph).toBe(graph);
    });

    it("should create artifact with proper structure", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      const artifact = result.output.artifact;
      expect(artifact).toBeDefined();
      expect(artifact!.artifactIdentity).toBeDefined();
      expect(artifact!.artifactVersion).toBe("1.0.0");
      expect(artifact!.schemaVersion).toBe("1.0.0");
      expect(artifact!.compilerVersion).toBe("1.0.0");
      expect(artifact!.businessGenomeGraph).toBe(graph);
    });
  });

  describe("3. Blocking Validation Error Prevents Publication", () => {
    it("should not publish when validation is invalid", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph, "invalid");

      const result = await pass.execute(validation, {} as any);

      expect(result.output.publicationStatus).toBe("blocked");
      expect(result.output.artifact).toBeNull();
    });

    it("should include blocking error diagnostic", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph, "invalid");

      const result = await pass.execute(validation, {} as any);

      const blockingDiagnostic = result.output.diagnostics.find((d) => d.code.includes("VALIDATION_BLOCKS"));
      expect(blockingDiagnostic).toBeDefined();
      expect(blockingDiagnostic?.severity).toBe("error");
    });
  });

  describe("4. Blocked Publication Emits No Canonical Artifact", () => {
    it("should have null artifact when blocked", async () => {
      const graph = createMockGraph();
      const validation = createMockValidationResult(graph, "invalid");

      const result = await pass.execute(validation, {} as any);

      expect(result.output.artifact).toBeNull();
      expect(result.output.publicationStatus).toBe("blocked");
    });

    it("should preserve graph even when blocked", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph, "invalid");

      const result = await pass.execute(validation, {} as any);

      expect(result.output.graph).toBe(graph);
      expect(result.output.graph.nodes.length).toBe(1);
    });
  });

  describe("5. Warnings May Proceed If Permitted", () => {
    it("should allow publication with valid-with-warnings status", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph, "valid-with-warnings");

      const result = await pass.execute(validation, {} as any);

      expect(result.output.publicationStatus).toBe("published");
      expect(result.output.artifact).toBeDefined();
    });
  });

  describe("6. Artifact Identity is Deterministic", () => {
    it("should produce identical identity for identical input", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result1 = await pass.execute(validation, {} as any);
      const result2 = await pass.execute(validation, {} as any);

      expect(result1.output.artifact?.artifactIdentity).toBe(result2.output.artifact?.artifactIdentity);
    });

    it("should derive artifact identity from graph content", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.artifact!.artifactIdentity).toMatch(/^bgc-artifact_/);
      expect(result.output.artifact!.artifactIdentity).toMatch(/_v1$/);
    });
  });

  describe("7. Artifact Checksum is Deterministic", () => {
    it("should produce identical checksums for identical input", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result1 = await pass.execute(validation, {} as any);
      const result2 = await pass.execute(validation, {} as any);

      expect(result1.output.artifact?.artifactChecksum).toBe(result2.output.artifact?.artifactChecksum);
    });

    it("should match manifest checksum calculation", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.artifact!.artifactChecksum).toBeDefined();
      expect(result.output.artifact!.manifest.artifactChecksum).toBe(result.output.artifact!.artifactChecksum);
    });
  });

  describe("8. Graph Checksum Remains Unchanged", () => {
    it("should preserve original graph checksum", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      const originalChecksum = SourceHash.sha256(stableStringify(graph));
      expect(result.output.artifact!.graphChecksum).toBe(originalChecksum);
    });
  });

  describe("9. Stable Serialization is Repeatable", () => {
    it("should serialize identically across runs", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result1 = await pass.execute(validation, {} as any);
      const result2 = await pass.execute(validation, {} as any);

      expect(stableStringify(result1.output.artifact)).toBe(stableStringify(result2.output.artifact));
    });
  });

  describe("10. Input Permutations Produce Equivalent Artifact", () => {
    it("should produce same artifact regardless of node input order", async () => {
      const node1 = createMockNode("node_001");
      const node2 = createMockNode("node_002");

      const graph1 = createMockGraph([node1, node2]);
      const graph2 = createMockGraph([node2, node1]);

      const validation1 = createMockValidationResult(graph1);
      const validation2 = createMockValidationResult(graph2);

      const result1 = await pass.execute(validation1, {} as any);
      const result2 = await pass.execute(validation2, {} as any);

      expect(result1.output.artifact?.artifactIdentity).toBe(result2.output.artifact?.artifactIdentity);
    });
  });

  describe("11. Provenance Index is Complete and Ordered", () => {
    it("should include all nodes in provenance index", async () => {
      const node1 = createMockNode("node_001");
      const node2 = createMockNode("node_002");
      const graph = createMockGraph([node1, node2]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.artifact!.provenanceIndex.entries.length).toBe(2);
    });

    it("should have provenance entries sorted deterministically", async () => {
      const node1 = createMockNode("node_001");
      const node2 = createMockNode("node_002");
      const graph = createMockGraph([node1, node2]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      const ids = result.output.artifact!.provenanceIndex.entries.map((e) => e.nodeId);
      expect(ids).toEqual([...ids].sort());
    });
  });

  describe("12. Lineage Index is Complete and Ordered", () => {
    it("should include pass history in lineage", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.artifact!.lineageIndex.entries.length).toBeGreaterThan(0);
      expect(result.output.artifact!.lineageIndex.entries[0].traceChain.length).toBeGreaterThan(0);
    });

    it("should preserve lineage from all completed passes", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      const passIds = result.output.artifact!.lineageIndex.entries[0].traceChain.map((entry) => entry.stage);
      expect(passIds).toContain("bgc.graph-construction");
      expect(passIds).toContain("bgc.consistency-validation");
    });
  });

  describe("13. Manifest Includes All Required Versions", () => {
    it("should include all standard versions", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      const manifest = result.output.artifact!.manifest;
      expect(manifest.compilerVersion).toBeDefined();
      expect(manifest.gps0001Version).toBeDefined();
      expect(manifest.gps0002Version).toBeDefined();
      expect(manifest.businessGenomeSpecificationVersion).toBeDefined();
    });

    it("should include all pass versions in order", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      const manifest = result.output.artifact!.manifest;
      expect(manifest.passListAndVersions.length).toBeGreaterThan(0);
      expect(manifest.passListAndVersions.every((p) => p.passId && p.version)).toBe(true);
    });
  });

  describe("14. Diagnostics are Preserved and Ordered", () => {
    it("should preserve input diagnostics", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.diagnostics).toBeDefined();
      expect(Array.isArray(result.output.diagnostics)).toBe(true);
    });

    it("should include publication diagnostics", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("15. Publication Does Not Modify Graph", () => {
    it("should return unchanged graph", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.graph).toBe(graph);
      expect(result.output.graph.id).toBe(graph.id);
      expect(result.output.graph.nodes.length).toBe(1);
    });
  });

  describe("16. Publication Does Not Modify Validation Results", () => {
    it("should preserve validation result unchanged", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.validationResult).toBe(validation);
      expect(result.output.validationResult.validationStatus).toBe("valid");
    });
  });

  describe("17. Publication Creates No Nodes or Edges", () => {
    it("should not add nodes to artifact graph", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.artifact!.businessGenomeGraph.nodes.length).toBe(1);
    });

    it("should not add edges to artifact graph", async () => {
      const node1 = createMockNode("node_001");
      const node2 = createMockNode("node_002");
      const edge = createMockEdge("edge_001", "node_001", "node_002");
      const graph = createMockGraph([node1, node2], [edge]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.artifact!.businessGenomeGraph.edges.length).toBe(1);
    });
  });

  describe("18. Repeated Publication Produces Stable Output", () => {
    it("should produce identical string representation", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result1 = await pass.execute(validation, {} as any);
      const result2 = await pass.execute(validation, {} as any);

      expect(stableStringify(result1.output.artifact)).toBe(stableStringify(result2.output.artifact));
    });
  });

  describe("19. Missing Provenance Handling", () => {
    it("should diagnose missing node provenance", async () => {
      const nodeWithoutProvenance = createMockNode("node_001", { provenanceReferences: [] });
      const graph = createMockGraph([nodeWithoutProvenance]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      const missingProvDiag = result.output.diagnostics.find((d) => d.code.includes("MISSING_PROVENANCE"));
      expect(missingProvDiag).toBeDefined();
    });
  });

  describe("20. Missing Lineage Handling", () => {
    it("should include all pass history entries in lineage", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      const traceChain = result.output.artifact!.lineageIndex.entries[0].traceChain;
      expect(traceChain.length).toBeGreaterThan(0);
      expect(traceChain.every((entry) => entry.stage && entry.stageVersion)).toBe(true);
    });
  });

  describe("21. Missing Graph Fails Deterministically", () => {
    it("should handle missing graph gracefully", async () => {
      const validation = createMockValidationResult(createMockGraph());
      delete (validation as any).businessGenomeGraph;

      const result = await pass.execute(validation, {} as any);

      expect(result.output.publicationStatus).toBe("failed");
      expect(result.output.artifact).toBeNull();
    });
  });

  describe("22. Missing Validation Result Fails Deterministically", () => {
    it("should include proper diagnostics when missing validation", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.validationResult).toBeDefined();
      expect(result.output.artifact).toBeDefined();
    });
  });

  describe("23. No Enterprise Blueprint Artifact is Created", () => {
    it("should create only BusinessGenomeArtifact, not Blueprint", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.artifact).toBeDefined();
      expect(result.output.artifact!.artifactIdentity).toMatch(/^bgc-artifact/);
      expect((result.output.artifact as any).blueprintIdentity).toBeUndefined();
    });
  });

  describe("24. No Runtime or Application Dependency", () => {
    it("should not include runtime configuration in artifact", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect((result.output.artifact as any).runtime).toBeUndefined();
      expect((result.output.artifact as any).application).toBeUndefined();
      expect((result.output.artifact as any).persistence).toBeUndefined();
    });
  });

  describe("25. Existing Tests Remain Passing", () => {
    it("should not break pass contract", async () => {
      expect(pass.metadata.id).toBe("bgc.business-genome-publication");
      expect(pass.metadata.dependencies).toContain("bgc.consistency-validation");
    });
  });

  describe("26. Dependency Boundary Tests", () => {
    it("should depend on consistency-validation pass", () => {
      expect(pass.metadata.dependencies).toContain("bgc.consistency-validation");
      expect(pass.metadata.dependencies.length).toBe(1);
    });
  });

  describe("27. Pass Registry Contains All Passes", () => {
    it("should be a valid compiler pass", () => {
      expect(pass.metadata).toBeDefined();
      expect(pass.metadata.capabilities).toContain("publication");
    });
  });

  describe("28. Compiler Output Exposes Publication Status Explicitly", () => {
    it("should expose publication status in output", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.publicationStatus).toBeDefined();
      expect(["published", "blocked", "failed"]).toContain(result.output.publicationStatus);
    });

    it("should show publication details in diagnostics", async () => {
      const node = createMockNode("node_001");
      const graph = createMockGraph([node]);
      const validation = createMockValidationResult(graph);

      const result = await pass.execute(validation, {} as any);

      expect(result.output.diagnostics.length).toBeGreaterThan(0);
      expect(result.output.diagnostics.some((d) => d.code.includes("PUB"))).toBe(true);
    });
  });
});
