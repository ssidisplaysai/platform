jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import {
  consumeGlwReferenceOwnerClaimForDispatch,
  consumeGlwReferenceOwnerGrant,
  issueGlwReferenceOwnerGrant,
  issueGlwReferencePreflightReceipt,
  projectGlwReferenceOwnerGrant,
  revokeGlwReferenceOwnerGrant,
  validateConsumedGlwReferenceOwnerClaim,
  type GlwReferenceOwnerContext,
} from "../reference-owner-authority";
import { resolveGlwTrustedOperatorPrincipal } from "../trusted-operator-principal";

const principal = { principalId: "owner-1", sessionId: "session-1", authority: "TEST_VERIFIED_SESSION" };
const now = new Date("2030-01-01T00:00:00.000Z");

function context(overrides: Partial<Omit<GlwReferenceOwnerContext, "principalId" | "principalSessionId">> = {}) {
  return {
    operationType: "REFERENCE_GENERATION_RETRY" as const,
    organizationId: "org", siteId: "site", campaignId: "campaign", referenceState: "IN",
    referenceFingerprint: "reference", campaignInstructionFingerprint: "instructions",
    productAuthorityFingerprint: "product", qaPolicyVersion: "qa-v1",
    wordpressReadAuthorityFingerprint: "wordpress", exactRuntime: "a".repeat(40),
    failedJobId: "failed-job", failedArtifactSha256: "b".repeat(64),
    ...overrides,
  };
}

function issue(overrides = {}) {
  const live = context(overrides);
  const receipt = issueGlwReferencePreflightReceipt({ principal, context: live, now });
  const grant = issueGlwReferenceOwnerGrant({ principal, preflightReceiptId: receipt.receiptId, liveContext: live, now });
  return { live, receipt, grant };
}

describe("GLW reference-generation owner authority", () => {
  let root: string;
  const original = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "glw-ref-owner-authority-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; });
  afterEach(() => { if (original === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = original; rmSync(root, { recursive: true, force: true }); });

  test("allows one exact consumption and denies replay", () => {
    const { live, receipt, grant } = issue();
    const claim = consumeGlwReferenceOwnerGrant({ principal, grantId: grant.grantId, preflightReceiptId: receipt.receiptId, liveContext: live, now });
    expect(validateConsumedGlwReferenceOwnerClaim({ claimId: claim.claimId, liveContext: { ...live, principalId: principal.principalId, principalSessionId: principal.sessionId } })).toEqual(claim);
    expect(() => consumeGlwReferenceOwnerGrant({ principal, grantId: grant.grantId, preflightReceiptId: receipt.receiptId, liveContext: live, now })).toThrow("already consumed");
  });

  test("allows one exact dispatch validation and denies direct-route replay", () => {
    const { live, receipt, grant } = issue();
    const claim = consumeGlwReferenceOwnerGrant({ principal, grantId: grant.grantId, preflightReceiptId: receipt.receiptId, liveContext: live, now });
    expect(consumeGlwReferenceOwnerClaimForDispatch({ claimId: claim.claimId, liveContext: live, now }).dispatchValidatedAt).toBe(now.toISOString());
    expect(() => consumeGlwReferenceOwnerClaimForDispatch({ claimId: claim.claimId, liveContext: live, now })).toThrow("already used");
  });

  test("concurrent double consumption produces one allow and one deny", async () => {
    const { live, receipt, grant } = issue();
    const results = await Promise.allSettled([1, 2].map(() => Promise.resolve().then(() => consumeGlwReferenceOwnerGrant({ principal, grantId: grant.grantId, preflightReceiptId: receipt.receiptId, liveContext: live, now }))));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  test("denies expired preflight and expired grant", () => {
    const receipt = issueGlwReferencePreflightReceipt({ principal, context: context(), now });
    expect(() => issueGlwReferenceOwnerGrant({ principal, preflightReceiptId: receipt.receiptId, liveContext: context(), now: new Date("2030-01-01T00:02:01.000Z") })).toThrow("expired");
    const active = issue();
    expect(() => consumeGlwReferenceOwnerGrant({ principal, grantId: active.grant.grantId, preflightReceiptId: active.receipt.receiptId, liveContext: active.live, now: new Date("2030-01-01T00:05:01.000Z") })).toThrow("expired");
  });

  test("projects exact grant validity without consuming authority", () => {
    const active = issue();
    expect(projectGlwReferenceOwnerGrant({ principal, liveContext: active.live, now })).toMatchObject({ grantId: active.grant.grantId, status: "ACTIVE", valid: true });
    expect(projectGlwReferenceOwnerGrant({ principal, liveContext: active.live, now: new Date("2030-01-01T00:05:01.000Z") })).toMatchObject({ grantId: active.grant.grantId, status: "EXPIRED", valid: false });
    expect(projectGlwReferenceOwnerGrant({ principal, liveContext: { ...active.live, referenceState: "IL" }, now })).toBeNull();
  });

  test("denies a preflight receipt used with a mismatched live context", () => {
    const receipt = issueGlwReferencePreflightReceipt({ principal, context: context(), now });
    expect(() => issueGlwReferenceOwnerGrant({ principal, preflightReceiptId: receipt.receiptId, liveContext: context({ referenceState: "IL" }), now })).toThrow("referenceState");
  });

  test("denies revoked grants", () => {
    const { live, receipt, grant } = issue();
    revokeGlwReferenceOwnerGrant({ grantId: grant.grantId, now });
    expect(() => consumeGlwReferenceOwnerGrant({ principal, grantId: grant.grantId, preflightReceiptId: receipt.receiptId, liveContext: live, now })).toThrow("revoked");
  });

  test.each([
    ["principal", { principalId: "wrong", sessionId: principal.sessionId, authority: principal.authority }, {}, "principalId"],
    ["session", { ...principal, sessionId: "wrong" }, {}, "principalSessionId"],
    ["organization", principal, { organizationId: "wrong" }, "organizationId"],
    ["site", principal, { siteId: "wrong" }, "siteId"],
    ["campaign", principal, { campaignId: "wrong" }, "campaignId"],
    ["state", principal, { referenceState: "IL" }, "referenceState"],
    ["reference", principal, { referenceFingerprint: "wrong" }, "referenceFingerprint"],
    ["instructions", principal, { campaignInstructionFingerprint: "wrong" }, "campaignInstructionFingerprint"],
    ["product", principal, { productAuthorityFingerprint: "wrong" }, "productAuthorityFingerprint"],
    ["qa", principal, { qaPolicyVersion: "wrong" }, "qaPolicyVersion"],
    ["wordpress", principal, { wordpressReadAuthorityFingerprint: "wrong" }, "wordpressReadAuthorityFingerprint"],
    ["runtime", principal, { exactRuntime: "c".repeat(40) }, "exactRuntime"],
    ["failed job", principal, { failedJobId: "wrong" }, "failedJobId"],
    ["failed artifact", principal, { failedArtifactSha256: "c".repeat(64) }, "failedArtifactSha256"],
  ])("denies wrong %s", (_label, consumingPrincipal, override, field) => {
    const { live, receipt, grant } = issue();
    expect(() => consumeGlwReferenceOwnerGrant({ principal: consumingPrincipal as typeof principal, grantId: grant.grantId, preflightReceiptId: receipt.receiptId, liveContext: { ...live, ...override }, now })).toThrow(String(field));
  });

  test("separates initial and retry operation types", () => {
    const initial = context({ operationType: "REFERENCE_GENERATION_INITIAL", failedJobId: null, failedArtifactSha256: null });
    const receipt = issueGlwReferencePreflightReceipt({ principal, context: initial, now });
    const grant = issueGlwReferenceOwnerGrant({ principal, preflightReceiptId: receipt.receiptId, liveContext: initial, now });
    expect(() => consumeGlwReferenceOwnerGrant({ principal, grantId: grant.grantId, preflightReceiptId: receipt.receiptId, liveContext: context(), now })).toThrow("operationType");
  });

  test("caller-supplied role headers never resolve a trusted principal", () => {
    const request = new NextRequest("https://genesis.example/api/glw/reference", { headers: { "x-gcp-roles": "platform_admin", "x-gcp-user": "owner" } });
    expect(resolveGlwTrustedOperatorPrincipal(request, { ...process.env, NODE_ENV: "production", GENESIS_OPERATOR_DIRECTORY_JSON: "[]" })).toMatchObject({ ok: false, code: "TRUSTED_OPERATOR_SESSION_UNAVAILABLE" });
  });
});