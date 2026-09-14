jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("GLW durable reference state selection", () => {
  const originalRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let root: string;

  beforeEach(() => {
    jest.resetModules();
    root = mkdtempSync(join(tmpdir(), "glw-reference-state-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
  });

  afterEach(() => {
    if (originalRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalRoot;
    rmSync(root, { recursive: true, force: true });
  });

  test("persists exact Indiana selection across module reload", async () => {
    const first = await import("../reference-state-selection-repository");
    first.saveGlwReferenceStateSelection({ campaignId: "campaign", organizationId: "org", siteId: "site", stateCode: "IN", selectedBy: "owner", selectedAt: "2030-01-01" });
    jest.resetModules();
    const reloaded = await import("../reference-state-selection-repository");
    expect(reloaded.getGlwReferenceStateSelection("campaign")).toMatchObject({ stateCode: "IN", selectedBy: "owner" });
  });
});