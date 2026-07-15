import type { CompilerDiagnostic, CompilerPassContext } from "../../core/types";
import type { CompilerPass, CompilerPassMetadata } from "../../core/types";
import type {
  BusinessGenomeIdentityCollection,
  BusinessGenomeIdentity,
  ConsolidatedSemantic,
  ResolvedRelationship,
  BusinessGenomeNode,
  BusinessGenomeEdge,
  GraphConstructionContext,
  NodeConstructionResult,
  EdgeConstructionResult,
  BusinessGenomeGraph,
  BusinessGenomePassResult,
} from "../pipeline-types";
import { deterministicIdentity } from "../pipeline-types";
import { createDiagnostic, BGC_DIAGNOSTIC_CODES, sortDiagnostics } from "../diagnostics";

/**
 * Graph construction rules following GPS-0001 standard.
 *
 * Rules are versioned, deterministic, and auditable. Every constructed graph
 * follows canonical Business Genome structural standards.
 */
export const GRAPH_CONSTRUCTION_RULES = [
  {
    id: "bgc.graph.rule.node-construction",
    version: "1.0.0",
    applicableTo: "semantic-object",
    description: "Construct Business Genome node from canonical semantic object identity",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
    rationaleCode: "BGC-RATIONALE-GRAPH-001",
  },
  {
    id: "bgc.graph.rule.edge-construction",
    version: "1.0.0",
    applicableTo: "semantic-relationship",
    description: "Construct Business Genome edge from canonical semantic relationship identity",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
    rationaleCode: "BGC-RATIONALE-GRAPH-002",
  },
] as const;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    deepFreeze(obj[key]);
  }

  return Object.freeze(value);
}

/**
 * BGC-PASS-009: Graph Construction
 *
 * Constructs the Business Genome Graph: a deterministic, immutable, ordered
 * projection of all canonical semantic objects and relationships.
 *
 * Input: BusinessGenomeIdentityCollection (M1.7)
 * Output: BusinessGenomeGraph (M1.8)
 *
 * Key invariant: Identical identities always produce identical graph.
 * Graph is NOT validated or published here.
 * No nodes or edges are synthesized.
 */
export class GraphConstructionPass
  implements CompilerPass<BusinessGenomeIdentityCollection, BusinessGenomePassResult<BusinessGenomeGraph>>
{
  readonly metadata: CompilerPassMetadata = {
    id: "bgc.graph-construction",
    version: "1.0.0",
    dependencies: ["bgc.identity-assignment"],
    description:
      "Deterministically constructs Business Genome Graph from canonical semantic objects and relationships",
    inputType: "business-genome-identity-collection",
    outputType: "business-genome-graph",
    capabilities: ["graph-construction", "determinism", "gps-0001-compliance"],
    lifecycle: "active" as const,
  };

  execute(
    input: BusinessGenomeIdentityCollection,
    context: CompilerPassContext,
  ): BusinessGenomePassResult<BusinessGenomeGraph> {
    void context;
    const diagnostics: CompilerDiagnostic[] = [];

    // Validate input
    if (!input || !input.semanticObjectIdentities || !input.relationshipIdentities) {
      const diagnostic = createDiagnostic(
        BGC_DIAGNOSTIC_CODES.PIPELINE.MISSING_REQUIRED_PASS_OUTPUT,
        "error",
        "Input BusinessGenomeIdentityCollection is missing or invalid",
        this.metadata.id,
      );
      diagnostics.push(diagnostic);
      return this.buildFatalResult(input, diagnostics);
    }

    const nodes: BusinessGenomeNode[] = [];
    const edges: BusinessGenomeEdge[] = [];
    const nodeConstructionResults: NodeConstructionResult[] = [];
    const edgeConstructionResults: EdgeConstructionResult[] = [];

    // Construct nodes from semantic object identities
    for (const identity of input.semanticObjectIdentities) {
      const sourceConsolidated = input.resolvedRelationships.consolidatedSemantics.consolidatedSemantics.find(
        (s) => s.id === identity.sourceConsolidatedSemanticId,
      );

      if (!sourceConsolidated) {
        const diagnostic = createDiagnostic(
          BGC_DIAGNOSTIC_CODES.GRAPH.NODE_CONSTRUCTION_FAILED,
          "error",
          `Cannot find source consolidated semantic for identity ${identity.id}`,
          this.metadata.id,
          { identityId: identity.id, sourceSemanticId: identity.sourceConsolidatedSemanticId },
        );
        diagnostics.push(diagnostic);
        continue;
      }

      const node = this.constructNode(identity, sourceConsolidated, input);
      nodes.push(node);

      const result: NodeConstructionResult = {
        canonicalNodeId: node.id,
        sourceIdentityId: identity.id,
        constructed: true,
        constructionRuleId: GRAPH_CONSTRUCTION_RULES[0].id,
        constructionRuleVersion: GRAPH_CONSTRUCTION_RULES[0].version,
        diagnostics: [
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.GRAPH.NODE_CONSTRUCTED,
            "info",
            `Node constructed from identity ${identity.id}`,
            this.metadata.id,
            { nodeId: node.id, semanticClass: node.semanticClass },
          ),
        ],
      };
      nodeConstructionResults.push(result);
      diagnostics.push(...result.diagnostics);
    }

    // Construct edges from relationship identities
    // First, build a map of identity ID to node ID for edge source/target lookup
    const nodeIdMap = new Map<string, string>();
    for (let i = 0; i < input.semanticObjectIdentities.length; i++) {
      if (i < nodes.length) {
        nodeIdMap.set(input.semanticObjectIdentities[i].id, nodes[i].id);
      }
    }

    for (const identity of input.relationshipIdentities) {
      const relationship = input.resolvedRelationships.relationships.find(
        (r) => r.id === identity.sourceRelationshipId,
      );

      if (!relationship) {
        const diagnostic = createDiagnostic(
          BGC_DIAGNOSTIC_CODES.GRAPH.EDGE_CONSTRUCTION_FAILED,
          "error",
          `Cannot find source resolved relationship for identity ${identity.id}`,
          this.metadata.id,
          { identityId: identity.id, sourceRelationshipId: identity.sourceRelationshipId },
        );
        diagnostics.push(diagnostic);
        continue;
      }

      // Find source and target nodes
      const sourceNodeIdentity = input.semanticObjectIdentities.find(
        (i) => i.sourceConsolidatedSemanticId === relationship.sourceConsolidatedSemanticId,
      );
      const targetNodeIdentity = input.semanticObjectIdentities.find(
        (i) => i.sourceConsolidatedSemanticId === relationship.targetConsolidatedSemanticId,
      );

      if (!sourceNodeIdentity || !targetNodeIdentity) {
        const diagnostic = createDiagnostic(
          BGC_DIAGNOSTIC_CODES.GRAPH.EDGE_CONSTRUCTION_FAILED,
          "error",
          `Cannot find source or target node identity for relationship ${identity.id}`,
          this.metadata.id,
          {
            relationshipId: identity.id,
            sourceIdentity: sourceNodeIdentity?.id,
            targetIdentity: targetNodeIdentity?.id,
          },
        );
        diagnostics.push(diagnostic);
        continue;
      }

      const sourceNodeId = nodeIdMap.get(sourceNodeIdentity.id);
      const targetNodeId = nodeIdMap.get(targetNodeIdentity.id);

      if (!sourceNodeId || !targetNodeId) {
        const diagnostic = createDiagnostic(
          BGC_DIAGNOSTIC_CODES.GRAPH.MISSING_SOURCE_NODE,
          "error",
          `Cannot find source or target node canonical ID for relationship ${identity.id}`,
          this.metadata.id,
          { relationshipId: identity.id, sourceNodeId, targetNodeId },
        );
        diagnostics.push(diagnostic);
        continue;
      }

      const edge = this.constructEdge(
        identity,
        relationship,
        sourceNodeId,
        targetNodeId,
        input,
      );
      edges.push(edge);

      const result: EdgeConstructionResult = {
        canonicalEdgeId: edge.id,
        sourceIdentityId: identity.id,
        constructed: true,
        sourceNodeId,
        targetNodeId,
        constructionRuleId: GRAPH_CONSTRUCTION_RULES[1].id,
        constructionRuleVersion: GRAPH_CONSTRUCTION_RULES[1].version,
        diagnostics: [
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.GRAPH.EDGE_CONSTRUCTED,
            "info",
            `Edge constructed from identity ${identity.id}`,
            this.metadata.id,
            { edgeId: edge.id, relationshipType: edge.relationshipType },
          ),
        ],
      };
      edgeConstructionResults.push(result);
      diagnostics.push(...result.diagnostics);
    }

    // Sort nodes and edges deterministically
    const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
    const sortedEdges = [...edges].sort((a, b) => a.id.localeCompare(b.id));
    const immutableNodes = sortedNodes.map((node) => deepFreeze(node));
    const immutableEdges = sortedEdges.map((edge) => deepFreeze(edge));

    // Build graph
    const graphId = this.deriveGraphIdentity({
      nodeIds: immutableNodes.map((n) => n.id),
      edgeIds: immutableEdges.map((e) => e.id),
    });

    const graph: BusinessGenomeGraph = {
      id: graphId,
      sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      nodes: deepFreeze(immutableNodes),
      edges: deepFreeze(immutableEdges),
      nodeConstructionResults: [...nodeConstructionResults].sort((a, b) =>
        a.canonicalNodeId.localeCompare(b.canonicalNodeId),
      ),
      edgeConstructionResults: [...edgeConstructionResults].sort((a, b) =>
        a.canonicalEdgeId.localeCompare(b.canonicalEdgeId),
      ),
      diagnostics: sortDiagnostics(diagnostics),
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      specificationVersion: input.specificationVersion,
      compilerVersion: input.compilerVersion,
      graphConstructionVersion: "1.0.0",
      passHistory: input.passHistory,
      businessGenomeIdentityCollection: input,
    };

    return {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      output: graph,
      diagnostics: sortDiagnostics(diagnostics),
      fatal: diagnostics.some((d) => d.severity === "error"),
    };
  }

  private constructNode(
    identity: BusinessGenomeIdentity,
    sourceConsolidated: ConsolidatedSemantic,
    input: BusinessGenomeIdentityCollection,
  ): BusinessGenomeNode {
    const context: GraphConstructionContext = {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      compilerVersion: input.compilerVersion,
      specificationVersion: input.specificationVersion,
      ruleId: GRAPH_CONSTRUCTION_RULES[0].id,
      ruleVersion: GRAPH_CONSTRUCTION_RULES[0].version,
      rationaleCode: GRAPH_CONSTRUCTION_RULES[0].rationaleCode,
      gps0001Version: identity.assignmentContext.gps0001Version,
      gps0002Version: identity.assignmentContext.gps0002Version,
    };

    const node: BusinessGenomeNode = {
      id: identity.id,
      semanticClass: identity.semanticClass || "",
      canonicalDesignation: sourceConsolidated.canonicalDesignation || sourceConsolidated.designation,
      sourceIdentityId: identity.id,
      sourceConsolidatedSemanticId: identity.sourceConsolidatedSemanticId,
      provenanceReferences: [...identity.provenanceReferences].sort(),
      evidenceLineage: [...identity.evidenceLineage].sort(),
      sourceEvidenceIrIdentity: identity.sourceEvidenceIrIdentity,
      constructedAt: "2024-01-01T00:00:00Z", // Deterministic timestamp
      certainty: identity.certainty,
      validationStatus: identity.validationStatus,
      graphConstructionContext: context,
      diagnostics: [
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.GRAPH.NODE_CONSTRUCTED,
          "info",
          `Node constructed for semantic class ${identity.semanticClass}`,
          this.metadata.id,
          { nodeId: identity.id },
        ),
      ],
    };

    return node;
  }

  private constructEdge(
    identity: BusinessGenomeIdentity,
    relationship: ResolvedRelationship,
    sourceNodeId: string,
    targetNodeId: string,
    input: BusinessGenomeIdentityCollection,
  ): BusinessGenomeEdge {
    const context: GraphConstructionContext = {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      compilerVersion: input.compilerVersion,
      specificationVersion: input.specificationVersion,
      ruleId: GRAPH_CONSTRUCTION_RULES[1].id,
      ruleVersion: GRAPH_CONSTRUCTION_RULES[1].version,
      rationaleCode: GRAPH_CONSTRUCTION_RULES[1].rationaleCode,
      gps0001Version: identity.assignmentContext.gps0001Version,
      gps0002Version: identity.assignmentContext.gps0002Version,
    };

    const edge: BusinessGenomeEdge = {
      id: identity.id,
      relationshipType: identity.relationshipType || "",
      sourceNodeId,
      targetNodeId,
      sourceIdentityId: identity.id,
      sourceRelationshipId: identity.sourceRelationshipId || "",
      provenanceReferences: [...identity.provenanceReferences].sort(),
      evidenceLineage: [...identity.evidenceLineage].sort(),
      sourceEvidenceIrIdentity: identity.sourceEvidenceIrIdentity,
      constructedAt: "2024-01-01T00:00:00Z", // Deterministic timestamp
      certainty: identity.certainty,
      validationStatus: identity.validationStatus,
      graphConstructionContext: context,
      diagnostics: [
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.GRAPH.EDGE_CONSTRUCTED,
          "info",
          `Edge constructed for relationship type ${identity.relationshipType}`,
          this.metadata.id,
          { edgeId: identity.id, sourceNodeId, targetNodeId },
        ),
      ],
    };

    return edge;
  }

  private deriveGraphIdentity(data: { nodeIds: string[]; edgeIds: string[] }): string {
    // Deterministic graph ID based on sorted node and edge IDs
    return deterministicIdentity("bg.graph", data);
  }

  private buildFatalResult(
    input: BusinessGenomeIdentityCollection,
    diagnostics: CompilerDiagnostic[],
  ): BusinessGenomePassResult<BusinessGenomeGraph> {
    const emptyGraph: BusinessGenomeGraph = {
      id: "bg.graph_invalid_v1",
      sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      nodes: [],
      edges: [],
      nodeConstructionResults: [],
      edgeConstructionResults: [],
      diagnostics: sortDiagnostics(diagnostics),
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      specificationVersion: input.specificationVersion,
      compilerVersion: input.compilerVersion,
      graphConstructionVersion: "1.0.0",
      passHistory: input.passHistory,
      businessGenomeIdentityCollection: input,
    };

    return {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      output: emptyGraph,
      diagnostics: sortDiagnostics(diagnostics),
      fatal: true,
    };
  }
}
