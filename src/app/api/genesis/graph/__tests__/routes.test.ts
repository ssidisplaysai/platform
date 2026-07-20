import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "@jest/globals";

import { ArtifactManager } from "../../../../../../genesis/runtime/artifacts";
import {
  ArtifactGraphService,
  resolveGraphRoot,
} from "../../../../../../genesis/runtime/graph";
import { GET as getGraphNode } from "../[artifactId]/route";
import { GET as getLineage } from "../lineage/[artifactId]/route";
import { GET as getGraphSummary } from "../route";

const originalEnvironment = { ...process.env };
const temporaryDirectories: string[] = [];

afterEach(async () => {
  process.env = { ...originalEnvironment };

  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function seedGraph(): Promise<{ artifactId: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "genesis-graph-routes-"));
  temporaryDirectories.push(root);

  const artifactManager = ArtifactManager.createLocal(root);
  const graphService = ArtifactGraphService.createLocal(resolveGraphRoot(root));

  const artifact = await artifactManager.create({
    type: "WorkbookInventory",
    version: "1.0.0",
    compilerId: "workbook",
    compilerVersion: "1.0.0",
    runtimeVersion: "1.0.0",
    payload: { spreadsheetId: "sheet-1" },
    metadata: { name: "Workbook Artifact" },
  });

  await artifactManager.save(artifact);
  await graphService.registerArtifact(artifact);

  return {
    artifactId: artifact.id,
    root,
  };
}

describe("Genesis graph APIs", () => {
  it("returns graph summary, node relationships, and lineage", async () => {
    const seeded = await seedGraph();
    process.env.GENESIS_ARTIFACT_ROOT = seeded.root;

    const summaryResponse = await getGraphSummary();
    const summary = await summaryResponse.json();

    expect(summaryResponse.status).toBe(200);
    expect(summary.nodes).toBe(1);
    expect(summary.edges).toBe(2);

    const nodeResponse = await getGraphNode(new Request("http://localhost"), {
      params: Promise.resolve({ artifactId: seeded.artifactId }),
    });
    const nodePayload = await nodeResponse.json();

    expect(nodeResponse.status).toBe(200);
    expect(nodePayload.node.artifactId).toBe(seeded.artifactId);
    expect(Array.isArray(nodePayload.dependencies)).toBe(true);
    expect(Array.isArray(nodePayload.parents)).toBe(true);

    const lineageResponse = await getLineage(new Request("http://localhost"), {
      params: Promise.resolve({ artifactId: seeded.artifactId }),
    });
    const lineagePayload = await lineageResponse.json();

    expect(lineageResponse.status).toBe(200);
    expect(lineagePayload.artifactId).toBe(seeded.artifactId);
    expect(lineagePayload.compiler).toBe("workbook");
  });
});
