import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "@jest/globals";

import {
  ArtifactGraphService,
  type ArtifactNode,
  resolveGraphRoot,
} from "..";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createGraphService(): Promise<ArtifactGraphService> {
  const root = await mkdtemp(join(tmpdir(), "genesis-graph-"));
  temporaryDirectories.push(root);

  return ArtifactGraphService.createLocal(resolveGraphRoot(root));
}

function createNode(
  artifactId: string,
  createdAt: string,
): ArtifactNode {
  return {
    artifactId,
    artifactType: "WorkbookInventory",
    compilerId: "workbook",
    runtimeVersion: "1.0.0",
    status: "ACTIVE",
    createdAt,
    metadata: {
      name: artifactId,
      description: "",
      tags: [],
      labels: {},
      owner: "runtime",
      company: "",
      project: "",
      environment: "test",
      customProperties: {},
    },
  };
}

describe("ArtifactGraphService", () => {
  it("creates nodes and relationships and resolves graph queries", async () => {
    const graphService = await createGraphService();

    await graphService.createNode(createNode("a1", "2026-01-01T00:00:00.000Z"));
    await graphService.createNode(createNode("a2", "2026-01-02T00:00:00.000Z"));
    await graphService.createNode(createNode("a3", "2026-01-03T00:00:00.000Z"));

    await graphService.createEdge({
      fromArtifactId: "a1",
      toArtifactId: "a2",
      type: "PARENT",
    });
    await graphService.createEdge({
      fromArtifactId: "a2",
      toArtifactId: "a1",
      type: "CHILD",
    });
    await graphService.createEdge({
      fromArtifactId: "a2",
      toArtifactId: "a3",
      type: "DEPENDS_ON",
    });

    expect(await graphService.getParents("a1")).toEqual(["a2"]);
    expect(await graphService.getChildren("a2")).toEqual(["a1"]);
    expect(await graphService.getDependencies("a2")).toEqual(["a3"]);
    expect(await graphService.getDependents("a3")).toEqual(["a2"]);

    const lineage = await graphService.getLineage("a2");

    expect(lineage).toBeDefined();
    expect(lineage?.parents).toEqual([]);
    expect(lineage?.children).toEqual(["a1"]);
    expect(lineage?.dependencies).toEqual(["a3"]);

    const summary = await graphService.getSummary();

    expect(summary.nodes).toBe(3);
    expect(summary.edges).toBe(3);
  });

  it("validates duplicate and circular edges", async () => {
    const graphService = await createGraphService();

    await graphService.createNode(createNode("b1", "2026-01-01T00:00:00.000Z"));
    await graphService.createNode(createNode("b2", "2026-01-02T00:00:00.000Z"));

    await graphService.createEdge({
      fromArtifactId: "b1",
      toArtifactId: "b2",
      type: "PARENT",
    });

    await expect(
      graphService.createEdge({
        fromArtifactId: "b1",
        toArtifactId: "b2",
        type: "PARENT",
      }),
    ).rejects.toThrow("Duplicate edge");

    await expect(
      graphService.createEdge({
        fromArtifactId: "b2",
        toArtifactId: "b1",
        type: "PARENT",
      }),
    ).rejects.toThrow("Circular edge");
  });
});
