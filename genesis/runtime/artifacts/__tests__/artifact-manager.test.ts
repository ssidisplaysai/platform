import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "@jest/globals";

import {
  ArtifactManager,
  isArtifactStatus,
} from "..";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createManager(): Promise<ArtifactManager> {
  const artifactRoot = await mkdtemp(
    join(tmpdir(), "genesis-artifacts-"),
  );

  temporaryDirectories.push(artifactRoot);

  return ArtifactManager.createLocal(artifactRoot);
}

describe("ArtifactManager", () => {
  it("creates immutable artifacts with deterministic hashing", async () => {
    const manager = await createManager();

    const artifact = await manager.create({
      type: "WorkbookInventory",
      version: "1.0.0",
      compilerId: "workbook",
      compilerVersion: "1.0.0",
      runtimeVersion: "2.0.0",
      payload: { sheetCount: 3, title: "Queue" },
      metadata: {
        name: "Workbook Queue Artifact",
        tags: ["workbook", "runtime"],
      },
      dependencies: [
        {
          id: "source-evidence-001",
          type: "evidence",
          relation: "source",
        },
      ],
      parentArtifacts: ["parent-001"],
      deterministicSeed: "seed-001",
      inputSummary: { spreadsheetId: "sheet-123" },
      outputSummary: { sheetCount: 3 },
    });

    expect(artifact.id).toBeDefined();
    expect(artifact.displayId).toMatch(/^ART-\d{8}$/);
    expect(artifact.sha256).toHaveLength(64);
    expect(artifact.manifest.sha256).toBe(artifact.sha256);
    expect(isArtifactStatus(artifact.status)).toBe(true);
    expect(Object.isFrozen(artifact)).toBe(true);
  });

  it("saves, loads, lists, validates, and checks existence", async () => {
    const manager = await createManager();

    const artifact = await manager.create({
      type: "WorkbookInventory",
      version: "1.0.0",
      compilerId: "workbook",
      compilerVersion: "1.0.0",
      runtimeVersion: "2.0.0",
      payload: { spreadsheetId: "sheet-123", sheetCount: 1 },
      metadata: { name: "Inventory" },
    });

    await manager.save(artifact);

    expect(await manager.exists(artifact.id)).toBe(true);

    const loaded = await manager.load(artifact.id);

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(artifact.id);
    expect(loaded?.metadata.name).toBe("Inventory");

    const validation = await manager.validate(artifact.id);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);

    const artifacts = await manager.list();

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.id).toBe(artifact.id);
  });

  it("returns validation errors for unknown artifacts", async () => {
    const manager = await createManager();

    const validation = await manager.validate("missing-artifact");

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain("was not found");
  });
});
