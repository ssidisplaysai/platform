jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  consumeExactPublicationRollbackGrant,
  EXACT_WORDPRESS_PUBLICATION,
  EXACT_WORDPRESS_ROLLBACK,
  issueExactPublicationRollbackGrant,
  issueExactPublicationRollbackPreflight,
  type ExactPublicationRollbackContext,
} from "../exact-publication-rollback-authority";

const principal = { principalId: "owner", sessionId: "session", authority: "GENESIS_SERVER_SESSION_V1" };
const indiana: ExactPublicationRollbackContext = {
  operation: EXACT_WORDPRESS_PUBLICATION,
  organizationId: "led-display-warehouse",
  siteId: "site-led-display-warehouse-production",
  campaignId: "campaign-outdoor",
  productId: "prod-outdoor-digital-sphere",
  targetId: "target-campaign-outdoor-in",
  stateCode: "IN",
  wordpressObjectId: "20115",
  parentObjectId: "20114",
  slug: "indiana",
  canonicalPath: "/outdoor-digital-sphere/indiana/",
  expectedH1: "Outdoor Digital Sphere in Indiana",
  expectedTitle: "Outdoor Digital Sphere in Indiana",
  featuredMediaId: 0,
  storedPostContentSha: "b".repeat(64),
  visualCertificationId: "visual-certification-indiana",
  runtimeSha: "a".repeat(40),
  expectedCurrentStatus: "draft",
  intendedStatus: "publish",
  sourcePublicationReceiptId: null,
};
const alaska: ExactPublicationRollbackContext = { ...indiana, targetId: "target-campaign-outdoor-ak", stateCode: "AK", wordpressObjectId: "20200", slug: "alaska", canonicalPath: "/outdoor-digital-sphere/alaska/", storedPostContentSha: "c".repeat(64), visualCertificationId: "visual-certification-alaska" };
const rollback = (sourcePublicationReceiptId = "publication-receipt"): ExactPublicationRollbackContext => ({ ...indiana, operation: EXACT_WORDPRESS_ROLLBACK, expectedCurrentStatus: "publish", intendedStatus: "draft", sourcePublicationReceiptId });

function grant(context = indiana, actor = principal) {
  const preflight = issueExactPublicationRollbackPreflight({ context, principal: actor, preflightVerified: true, now: new Date("2030-01-01T00:00:00Z") });
  const issued = issueExactPublicationRollbackGrant({ preflightId: preflight.preflightId, context, principal: actor, now: new Date("2030-01-01T00:00:01Z") });
  return { preflight, issued };
}

describe("shared exact publication and rollback authority", () => {
  const priorRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "exact-publication-authority-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; });
  afterEach(() => { if (priorRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = priorRoot; rmSync(root, { recursive: true, force: true }); });

  test.each([
    ["wrong object", { wordpressObjectId: "999" }],
    ["wrong target", { targetId: "wrong" }],
    ["wrong site", { siteId: "wrong" }],
    ["wrong parent", { parentObjectId: "999" }],
    ["wrong slug", { slug: "wrong" }],
    ["wrong canonical path", { canonicalPath: "/wrong/" }],
    ["wrong content SHA", { storedPostContentSha: "d".repeat(64) }],
    ["wrong visual certification", { visualCertificationId: "wrong" }],
    ["wrong runtime", { runtimeSha: "e".repeat(40) }],
  ])("blocks %s after preflight", (_name, patch) => {
    const { preflight } = grant();
    expect(() => issueExactPublicationRollbackGrant({ preflightId: preflight.preflightId, context: { ...indiana, ...patch }, principal, now: new Date("2030-01-01T00:00:02Z") })).toThrow();
  });

  test.each([
    ["wrong principal", { ...principal, principalId: "other" }],
    ["wrong session", { ...principal, sessionId: "other" }],
  ])("blocks %s", (_name, actor) => {
    const { preflight } = grant();
    expect(() => issueExactPublicationRollbackGrant({ preflightId: preflight.preflightId, context: indiana, principal: actor, now: new Date("2030-01-01T00:00:02Z") })).toThrow();
  });

  test("blocks expired grants", () => {
    const { preflight, issued } = grant();
    expect(() => consumeExactPublicationRollbackGrant({ preflightId: preflight.preflightId, grantId: issued.grantId, context: indiana, principal, now: new Date("2030-01-01T00:05:02Z") })).toThrow("EXACT_OPERATION_GRANT_EXPIRED");
  });

  test("atomically blocks consumed grant replay and concurrent double consumption", async () => {
    const { preflight, issued } = grant();
    const consume = () => Promise.resolve().then(() => consumeExactPublicationRollbackGrant({ preflightId: preflight.preflightId, grantId: issued.grantId, context: indiana, principal, now: new Date("2030-01-01T00:00:02Z") }));
    const results = await Promise.allSettled([consume(), consume()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(() => consumeExactPublicationRollbackGrant({ preflightId: preflight.preflightId, grantId: issued.grantId, context: indiana, principal, now: new Date("2030-01-01T00:00:03Z") })).toThrow("EXACT_OPERATION_GRANT_CONSUMED");
  });

  test.each([["Indiana", indiana], ["Alaska", alaska]])("accepts %s as target-specific data", (_name, context) => {
    const { preflight, issued } = grant(context);
    expect(consumeExactPublicationRollbackGrant({ preflightId: preflight.preflightId, grantId: issued.grantId, context, principal, now: new Date("2030-01-01T00:00:02Z") })).toMatchObject({ targetId: context.targetId, wordpressObjectId: context.wordpressObjectId, operation: EXACT_WORDPRESS_PUBLICATION });
  });

  test("requires separate rollback owner authority", () => {
    const publication = grant();
    expect(() => consumeExactPublicationRollbackGrant({ preflightId: publication.preflight.preflightId, grantId: publication.issued.grantId, context: rollback(), principal, now: new Date("2030-01-01T00:00:02Z") })).toThrow("EXACT_OPERATION_GRANT_CONTEXT_MISMATCH");
    const rollbackAuthority = grant(rollback());
    expect(rollbackAuthority.issued.operation).toBe(EXACT_WORDPRESS_ROLLBACK);
  });

  test("publication authority cannot authorize rollback and rollback authority cannot authorize publication", () => {
    const publication = grant();
    expect(() => consumeExactPublicationRollbackGrant({ preflightId: publication.preflight.preflightId, grantId: publication.issued.grantId, context: rollback(), principal, now: new Date("2030-01-01T00:00:02Z") })).toThrow();
    const rollbackAuthority = grant(rollback());
    expect(() => consumeExactPublicationRollbackGrant({ preflightId: rollbackAuthority.preflight.preflightId, grantId: rollbackAuthority.issued.grantId, context: indiana, principal, now: new Date("2030-01-01T00:00:02Z") })).toThrow();
  });

  test("rollback rejects missing publication receipt", () => {
    expect(() => issueExactPublicationRollbackPreflight({ context: rollback(""), principal, preflightVerified: true })).toThrow("EXACT_ROLLBACK_TRANSITION_INVALID");
  });

  test("rollback grant is single-use and replay resistant", () => {
    const context = rollback();
    const { preflight, issued } = grant(context);
    consumeExactPublicationRollbackGrant({ preflightId: preflight.preflightId, grantId: issued.grantId, context, principal, now: new Date("2030-01-01T00:00:02Z") });
    expect(() => consumeExactPublicationRollbackGrant({ preflightId: preflight.preflightId, grantId: issued.grantId, context, principal, now: new Date("2030-01-01T00:00:03Z") })).toThrow("EXACT_OPERATION_GRANT_CONSUMED");
  });

  test("shared production implementation contains no Indiana or Alaska branches", () => {
    for (const path of ["src/modules/glw/exact-publication-rollback-authority.ts", "src/modules/glw/exact-publication-rollback-service.ts", "src/modules/glw/exact-publication-rollback-live-authority.ts", "src/app/api/glw/campaigns/[campaignId]/rich-reference-publication/route.ts"]) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(/\b(?:Indiana|Alaska)\b/);
      expect(source).not.toMatch(/if\s*\([^)]*(?:stateCode|targetId)[^)]*(?:IN|AK)/);
    }
  });
});
