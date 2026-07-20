import type { GenesisArtifact } from "../artifacts";

import {
  createArtifactEdgeId,
  type ArtifactEdge,
  type CreateArtifactEdgeRequest,
} from "./artifact-edge";
import type { ArtifactLineage } from "./artifact-lineage";
import type { ArtifactNode } from "./artifact-node";
import {
  LocalGraphRepository,
  type GraphRepository,
} from "./graph-repository";
import type { ArtifactGraphSummary } from "./graph-types";
import { GraphValidator } from "./graph-validator";

export class ArtifactGraphService {
  public constructor(
    private readonly repository: GraphRepository,
    private readonly validator = new GraphValidator(),
  ) {}

  public static createLocal(graphRoot: string): ArtifactGraphService {
    return new ArtifactGraphService(
      new LocalGraphRepository(graphRoot),
    );
  }

  public async createNode(node: ArtifactNode): Promise<void> {
    const existingNodes = await this.repository.listNodes();
    const validation = this.validator.validateNode(
      node,
      existingNodes,
    );

    if (!validation.valid) {
      throw new Error(validation.errors.join(" "));
    }

    await this.repository.saveNode(node);
  }

  public async createEdge(
    request: CreateArtifactEdgeRequest,
  ): Promise<ArtifactEdge> {
    const edges = await this.repository.listEdges();
    const nodes = await this.repository.listNodes();

    const edge: ArtifactEdge = {
      id: createArtifactEdgeId(request),
      fromArtifactId: request.fromArtifactId,
      toArtifactId: request.toArtifactId,
      type: request.type,
      createdAt: new Date().toISOString(),
      metadata: { ...(request.metadata ?? {}) },
    };

    const validation = this.validator.validateEdge(
      edge,
      edges,
      nodes,
    );

    if (!validation.valid) {
      throw new Error(validation.errors.join(" "));
    }

    await this.repository.saveEdge(edge);
    return edge;
  }

  public async removeEdge(edgeId: string): Promise<boolean> {
    return this.repository.removeEdge(edgeId);
  }

  public async getParents(
    artifactId: string,
  ): Promise<readonly string[]> {
    const edges = await this.repository.listEdges();

    return edges
      .filter(
        (edge) =>
          edge.fromArtifactId === artifactId && edge.type === "PARENT",
      )
      .map((edge) => edge.toArtifactId)
      .sort((left, right) => left.localeCompare(right));
  }

  public async getChildren(
    artifactId: string,
  ): Promise<readonly string[]> {
    const edges = await this.repository.listEdges();

    return edges
      .filter(
        (edge) =>
          edge.fromArtifactId === artifactId && edge.type === "CHILD",
      )
      .map((edge) => edge.toArtifactId)
      .sort((left, right) => left.localeCompare(right));
  }

  public async getDependencies(
    artifactId: string,
  ): Promise<readonly string[]> {
    const edges = await this.repository.listEdges();

    return edges
      .filter(
        (edge) =>
          edge.fromArtifactId === artifactId &&
          edge.type === "DEPENDS_ON",
      )
      .map((edge) => edge.toArtifactId)
      .sort((left, right) => left.localeCompare(right));
  }

  public async getDependents(
    artifactId: string,
  ): Promise<readonly string[]> {
    const edges = await this.repository.listEdges();

    return edges
      .filter(
        (edge) =>
          edge.toArtifactId === artifactId && edge.type === "DEPENDS_ON",
      )
      .map((edge) => edge.fromArtifactId)
      .sort((left, right) => left.localeCompare(right));
  }

  public async getLineage(
    artifactId: string,
  ): Promise<ArtifactLineage | null> {
    const cached = await this.repository.loadLineage(artifactId);

    if (cached) {
      return cached;
    }

    const node = await this.repository.loadNode(artifactId);

    if (!node) {
      return null;
    }

    const parents = await this.getParents(artifactId);
    const children = await this.getChildren(artifactId);
    const dependencies = await this.getDependencies(artifactId);
    const generationDepth = await this.calculateGenerationDepth(
      artifactId,
    );

    const lineage: ArtifactLineage = {
      artifactId,
      parents,
      children,
      dependencies,
      compiler: node.compilerId,
      runtime: node.runtimeVersion,
      createdAt: node.createdAt,
      generationDepth,
      sourceEvidence: dependencies.filter((dependencyId) =>
        dependencyId.toLowerCase().startsWith("evidence"),
      ),
    };

    await this.repository.saveLineage(lineage);

    return lineage;
  }

  public async exists(artifactId: string): Promise<boolean> {
    return (await this.repository.loadNode(artifactId)) !== null;
  }

  public async validate(
    artifactId: string,
  ): Promise<{ valid: boolean; errors: readonly string[] }> {
    const node = await this.repository.loadNode(artifactId);

    if (!node) {
      return {
        valid: false,
        errors: [`Artifact node '${artifactId}' was not found.`],
      };
    }

    const lineage = await this.getLineage(artifactId);

    if (!lineage) {
      return {
        valid: false,
        errors: [`Lineage for '${artifactId}' was not found.`],
      };
    }

    return this.validator.validateLineage(lineage, node);
  }

  public async registerArtifact(
    artifact: GenesisArtifact,
  ): Promise<void> {
    const node: ArtifactNode = {
      artifactId: artifact.id,
      artifactType: artifact.type,
      compilerId: artifact.compilerId,
      runtimeVersion: artifact.runtimeVersion,
      status: artifact.status,
      createdAt: artifact.createdAt,
      metadata: artifact.metadata,
    };

    if (!(await this.exists(artifact.id))) {
      await this.createNode(node);
    }

    for (const parentId of artifact.parentArtifacts) {
      await this.tryCreateEdge({
        fromArtifactId: artifact.id,
        toArtifactId: parentId,
        type: "PARENT",
      });
      await this.tryCreateEdge({
        fromArtifactId: parentId,
        toArtifactId: artifact.id,
        type: "CHILD",
      });
    }

    for (const dependency of artifact.dependencies) {
      await this.tryCreateEdge({
        fromArtifactId: artifact.id,
        toArtifactId: dependency.id,
        type: "DEPENDS_ON",
        metadata: {
          dependencyType: dependency.type,
          relation: dependency.relation,
        },
      });
    }

    await this.tryCreateEdge({
      fromArtifactId: artifact.id,
      toArtifactId: `compiler:${artifact.compilerId}@${artifact.compilerVersion}`,
      type: "GENERATED_FROM",
    });

    await this.tryCreateEdge({
      fromArtifactId: artifact.id,
      toArtifactId: `runtime:${artifact.runtimeVersion}`,
      type: "REFERENCES",
    });

    await this.getLineage(artifact.id);
  }

  public async getNode(artifactId: string): Promise<ArtifactNode | null> {
    return this.repository.loadNode(artifactId);
  }

  public async getSummary(): Promise<ArtifactGraphSummary> {
    const nodes = await this.repository.listNodes();
    const edges = await this.repository.listEdges();

    const rootArtifacts = nodes.filter((node) =>
      edges.every(
        (edge) =>
          !(edge.fromArtifactId === node.artifactId &&
            edge.type === "PARENT"),
      ),
    ).length;

    const leafArtifacts = nodes.filter((node) =>
      edges.every(
        (edge) =>
          !(edge.fromArtifactId === node.artifactId &&
            edge.type === "CHILD"),
      ),
    ).length;

    const lineages = await this.repository.listLineages();

    return {
      nodes: nodes.length,
      edges: edges.length,
      lineageTrees: lineages.length,
      rootArtifacts,
      leafArtifacts,
    };
  }

  private async calculateGenerationDepth(
    artifactId: string,
  ): Promise<number> {
    const parents = await this.getParents(artifactId);

    if (!parents.length) {
      return 0;
    }

    const parentDepths = await Promise.all(
      parents.map(async (parentId) => {
        const lineage = await this.repository.loadLineage(parentId);

        if (lineage) {
          return lineage.generationDepth;
        }

        return 0;
      }),
    );

    return Math.max(...parentDepths) + 1;
  }

  private async tryCreateEdge(
    request: CreateArtifactEdgeRequest,
  ): Promise<void> {
    try {
      await this.createEdge(request);
    } catch {
      // Ignore duplicate or invalid optional reference edges.
    }
  }
}
