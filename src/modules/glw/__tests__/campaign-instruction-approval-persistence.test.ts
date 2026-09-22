jest.mock("server-only", () => ({}));

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("campaign instruction approval persistence", () => {
  const originalPersistence = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  const originalSessionPersistence = process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR;
  let root = "";

  beforeEach(() => {
    jest.resetModules();
    root = mkdtempSync(join(tmpdir(), "glw-instruction-approval-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
    process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR = root;
  });

  afterEach(() => {
    if (originalPersistence === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalPersistence;

    if (originalSessionPersistence === undefined) delete process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR;
    else process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR = originalSessionPersistence;

    rmSync(root, { recursive: true, force: true });
  });

  test("approve instructions persists text and durable approval metadata across reload", async () => {
    const first = await import("@/modules/glw/campaign-reference-repository");
    const campaignId = "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-expanded-cities";
    const approved = first.updateGlwCampaignInstructions({
      campaignId,
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      instructions: "  Approved instruction text for Arlington reference.  ",
    });

    expect(approved.instructions).toBe("Approved instruction text for Arlington reference.");
    expect(typeof approved.approvedAt).toBe("string");
    expect((approved.approvedInstructionSha256 ?? "")).toMatch(/^[0-9a-f]{64}$/);
    expect(approved.approvedInstructionRevision).toBe(1);

    jest.resetModules();

    const reloaded = await import("@/modules/glw/campaign-reference-repository");
    const persisted = reloaded.getGlwCampaignKnowledgePack(campaignId);

    expect(persisted?.instructions).toBe("Approved instruction text for Arlington reference.");
    expect(typeof persisted?.approvedAt).toBe("string");
    expect((persisted?.approvedInstructionSha256 ?? "")).toMatch(/^[0-9a-f]{64}$/);
    expect(persisted?.approvedInstructionRevision).toBe(1);
  });

  test("adding references does not clear approved instruction state", async () => {
    const repository = await import("@/modules/glw/campaign-reference-repository");
    const campaignId = "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-expanded-cities";

    const approved = repository.updateGlwCampaignInstructions({
      campaignId,
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      instructions: "Approved instructions remain authoritative.",
    });

    const added = repository.addGlwCampaignReference({
      campaignId,
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      fileName: "authority.txt",
      mediaType: "text/plain",
      bytes: new TextEncoder().encode("Authority source"),
      scope: "campaign",
      role: "authoritative_fact",
    });

    expect(added.error).toBeNull();

    const persisted = repository.getGlwCampaignKnowledgePack(campaignId);
    expect(persisted?.approvedAt).toBe(approved.approvedAt);
    expect(persisted?.approvedInstructionRevision).toBe(approved.approvedInstructionRevision);
    expect(persisted?.approvedInstructionSha256).toBe(approved.approvedInstructionSha256);
    expect(persisted?.references.length).toBe(1);
  });

  test("UI uses durable approval metadata and normalizes instructions after approval", () => {
    const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8").replace(/\s/g, "");
    expect(ui).toContain("constinstructionsApproved=Boolean(pack?.approvedAt)&&pack?.instructions===instructions;");
    expect(ui).toContain("setInstructions(payload.knowledgePack.instructions??\"\");");
    expect(ui).toContain('action:"RUN_PREFLIGHT"');
  });
});
