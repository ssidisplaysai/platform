jest.mock("server-only", () => ({}));
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { inspectGlwReferenceParentInventory } from "../reference-parent-inventory";
import { consumeGlwReferenceParentCreationGrant, issueGlwReferenceParentCreationGrant, issueGlwReferenceParentCreationPreflight } from "../reference-parent-creation-authority";

const principal = { principalId: "owner", sessionId: "session", authority: "GENESIS_SERVER_SESSION_V1" };
const context = { operationType: "REFERENCE_PARENT_DRAFT_CREATION" as const, organizationId: "org", siteId: "site", campaignId: "campaign", exactRuntime: "a".repeat(40), title: "Outdoor Digital Sphere", slug: "outdoor-digital-sphere", parentId: "0" as const, wordpressStatus: "draft" as const, inventoryFingerprint: "b".repeat(64), canonicalProductPath: "/outdoor-digital-sphere/", authorityClassification: "MISSING_PARENT_REQUIRES_CREATION" as const };
function reader(rows: unknown[] = [], fail = false): AuthenticatedWordPressReadAuthority { return { getJson: jest.fn(async ({ path }) => fail ? { ok: false, reason: "NETWORK_ERROR" as const } : { ok: true, body: path === "/pages" ? rows : [], pagination: { total: path === "/pages" ? rows.length : 0, totalPages: 1 } }) }; }

describe("Outdoor Digital Sphere parent authority", () => {
  let root: string; const original = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "glw-parent-authority-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; });
  afterEach(() => { if (original === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = original; rmSync(root, { recursive: true, force: true }); });

  test("classifies complete empty inventory as missing", async () => {
    const result = await inspectGlwReferenceParentInventory(reader());
    expect(result).toMatchObject({ complete: true, classification: "MISSING_PARENT_REQUIRES_CREATION", exactSlugMatches: [], equivalentMatches: [] });
  });
  test("classifies failed reads as ambiguous", async () => { expect(await inspectGlwReferenceParentInventory(reader([], true))).toMatchObject({ complete: false, classification: "AMBIGUOUS" }); });
  test("finds exact and equivalent authority without adopting Indoor Digital Sphere", async () => {
    const exact = await inspectGlwReferenceParentInventory(reader([{ id: 10, type: "page", title: { raw: "Outdoor Digital Sphere" }, slug: "outdoor-digital-sphere", status: "draft", parent: 0, content: { raw: "" } }]));
    expect(exact).toMatchObject({ classification: "EXISTING_EXACT_PARENT", exactSlugMatches: [expect.objectContaining({ objectId: 10 })] });
    const indoor = await inspectGlwReferenceParentInventory(reader([{ id: 11, type: "page", title: { raw: "Indoor Digital Sphere" }, slug: "indoor-digital-sphere", status: "publish", parent: 0, content: { raw: "Outdoor digital sphere comparison." } }]));
    expect(indoor).toMatchObject({ classification: "MISSING_PARENT_REQUIRES_CREATION", equivalentMatches: [] });
  });
  test("issues and consumes one inventory-bound grant and denies replay", () => {
    const now = new Date("2030-01-01T00:00:00Z"), preflight = issueGlwReferenceParentCreationPreflight({ principal, context, now }), grant = issueGlwReferenceParentCreationGrant({ principal, preflightId: preflight.preflightId, liveContext: context, now });
    const claim = consumeGlwReferenceParentCreationGrant({ principal, preflightId: preflight.preflightId, grantId: grant.grantId, liveContext: context, now });
    expect(claim).toMatchObject({ inventoryFingerprint: context.inventoryFingerprint, wordpressStatus: "draft", parentId: "0" });
    expect(() => consumeGlwReferenceParentCreationGrant({ principal, preflightId: preflight.preflightId, grantId: grant.grantId, liveContext: context, now })).toThrow("already consumed");
  });
  test("rejects runtime, session, inventory, and identity mismatch", () => {
    const now = new Date("2030-01-01T00:00:00Z"), preflight = issueGlwReferenceParentCreationPreflight({ principal, context, now }), grant = issueGlwReferenceParentCreationGrant({ principal, preflightId: preflight.preflightId, liveContext: context, now });
    for (const [changedPrincipal, changedContext] of [[{ ...principal, sessionId: "other" }, context], [principal, { ...context, exactRuntime: "c".repeat(40) }], [principal, { ...context, inventoryFingerprint: "d".repeat(64) }], [principal, { ...context, title: "Other" }]] as const) expect(() => consumeGlwReferenceParentCreationGrant({ principal: changedPrincipal, preflightId: preflight.preflightId, grantId: grant.grantId, liveContext: changedContext as typeof context, now })).toThrow();
  });
});
