import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import type { ArtifactEdge } from "./artifact-edge";
import type { ArtifactLineage } from "./artifact-lineage";
import type { ArtifactNode } from "./artifact-node";

export interface GraphRepository {
  saveNode(node: ArtifactNode): Promise<void>;
  loadNode(artifactId: string): Promise<ArtifactNode | null>;
  listNodes(): Promise<readonly ArtifactNode[]>;
  saveEdge(edge: ArtifactEdge): Promise<void>;
  removeEdge(edgeId: string): Promise<boolean>;
  listEdges(): Promise<readonly ArtifactEdge[]>;
  saveLineage(lineage: ArtifactLineage): Promise<void>;
  loadLineage(artifactId: string): Promise<ArtifactLineage | null>;
  listLineages(): Promise<readonly ArtifactLineage[]>;
}

async function readJson<TValue>(path: string): Promise<TValue> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as TValue;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export class LocalGraphRepository implements GraphRepository {
  public constructor(private readonly graphRoot: string) {}

  public getNodesRoot(): string {
    return join(this.graphRoot, "nodes");
  }

  public getEdgesRoot(): string {
    return join(this.graphRoot, "edges");
  }

  public getLineageRoot(): string {
    return join(this.graphRoot, "lineage");
  }

  private getNodePath(artifactId: string): string {
    return join(this.getNodesRoot(), `${artifactId}.json`);
  }

  private getEdgePath(edgeId: string): string {
    return join(this.getEdgesRoot(), `${edgeId}.json`);
  }

  private getLineagePath(artifactId: string): string {
    return join(this.getLineageRoot(), `${artifactId}.json`);
  }

  private async ensureRoots(): Promise<void> {
    await mkdir(this.getNodesRoot(), { recursive: true });
    await mkdir(this.getEdgesRoot(), { recursive: true });
    await mkdir(this.getLineageRoot(), { recursive: true });
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  public async saveNode(node: ArtifactNode): Promise<void> {
    await this.ensureRoots();
    await writeJson(this.getNodePath(node.artifactId), node);
  }

  public async loadNode(artifactId: string): Promise<ArtifactNode | null> {
    const nodePath = this.getNodePath(artifactId);

    if (!(await this.fileExists(nodePath))) {
      return null;
    }

    return readJson<ArtifactNode>(nodePath);
  }

  public async listNodes(): Promise<readonly ArtifactNode[]> {
    await this.ensureRoots();

    const files = await readdir(this.getNodesRoot(), {
      withFileTypes: true,
    });

    const nodeFiles = files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(this.getNodesRoot(), entry.name));

    const nodes = await Promise.all(
      nodeFiles.map((filePath) => readJson<ArtifactNode>(filePath)),
    );

    return nodes.sort((left, right) =>
      left.artifactId.localeCompare(right.artifactId),
    );
  }

  public async saveEdge(edge: ArtifactEdge): Promise<void> {
    await this.ensureRoots();
    await writeJson(this.getEdgePath(edge.id), edge);
  }

  public async removeEdge(edgeId: string): Promise<boolean> {
    await this.ensureRoots();

    const edgePath = this.getEdgePath(edgeId);

    if (!(await this.fileExists(edgePath))) {
      return false;
    }

    await rm(edgePath, { force: true });
    return true;
  }

  public async listEdges(): Promise<readonly ArtifactEdge[]> {
    await this.ensureRoots();

    const files = await readdir(this.getEdgesRoot(), {
      withFileTypes: true,
    });

    const edgeFiles = files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(this.getEdgesRoot(), entry.name));

    const edges = await Promise.all(
      edgeFiles.map((filePath) => readJson<ArtifactEdge>(filePath)),
    );

    return edges.sort((left, right) => left.id.localeCompare(right.id));
  }

  public async saveLineage(lineage: ArtifactLineage): Promise<void> {
    await this.ensureRoots();
    await writeJson(this.getLineagePath(lineage.artifactId), lineage);
  }

  public async loadLineage(
    artifactId: string,
  ): Promise<ArtifactLineage | null> {
    const lineagePath = this.getLineagePath(artifactId);

    if (!(await this.fileExists(lineagePath))) {
      return null;
    }

    return readJson<ArtifactLineage>(lineagePath);
  }

  public async listLineages(): Promise<readonly ArtifactLineage[]> {
    await this.ensureRoots();

    const files = await readdir(this.getLineageRoot(), {
      withFileTypes: true,
    });

    const lineageFiles = files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(this.getLineageRoot(), entry.name));

    const lineages = await Promise.all(
      lineageFiles.map((filePath) =>
        readJson<ArtifactLineage>(filePath),
      ),
    );

    return lineages.sort((left, right) =>
      left.artifactId.localeCompare(right.artifactId),
    );
  }
}

export function resolveGraphRoot(artifactRoot: string): string {
  return join(artifactRoot, "graph");
}
