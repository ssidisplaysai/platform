import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "@jest/globals";

import { ArtifactManager } from "../../../../../../genesis/runtime/artifacts";
import { GET as getArtifact } from "../[id]/route";
import { GET as listArtifacts } from "../route";
import { POST as validateArtifact } from "../validate/route";

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

async function seedArtifactStore(): Promise<{ id: string; root: string }> {
  const artifactRoot = await mkdtemp(
    join(tmpdir(), "genesis-artifact-routes-"),
  );
  temporaryDirectories.push(artifactRoot);

  const manager = ArtifactManager.createLocal(artifactRoot);
  const artifact = await manager.create({
    type: "WorkbookInventory",
    version: "1.0.0",
    compilerId: "workbook",
    compilerVersion: "1.0.0",
    runtimeVersion: "2.0.0",
    payload: {
      spreadsheetId: "sheet-123",
      sheetCount: 2,
    },
    metadata: {
      name: "Workbook Inventory",
    },
  });

  await manager.save(artifact);

  return { id: artifact.id, root: artifactRoot };
}

describe("Genesis artifact APIs", () => {
  it("lists, retrieves, and validates artifacts via ArtifactManager", async () => {
    const seeded = await seedArtifactStore();

    process.env.GENESIS_ARTIFACT_ROOT = seeded.root;

    const listResponse = await listArtifacts();
    const listPayload = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listPayload.artifactCount).toBe(1);
    expect(listPayload.artifacts[0].id).toBe(seeded.id);

    const detailResponse = await getArtifact(new Request("http://localhost"), {
      params: Promise.resolve({ id: seeded.id }),
    });
    const detailPayload = await detailResponse.json();

    expect(detailResponse.status).toBe(200);
    expect(detailPayload.id).toBe(seeded.id);
    expect(detailPayload.metadata.name).toBe("Workbook Inventory");

    const validateResponse = await validateArtifact(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: seeded.id }),
      }),
    );
    const validatePayload = await validateResponse.json();

    expect(validateResponse.status).toBe(200);
    expect(validatePayload.valid).toBe(true);
    expect(validatePayload.errors).toEqual([]);
  });
});
