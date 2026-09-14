jest.mock("server-only", () => ({}));

const persisted = new Map<string, { revision: number; state: unknown }>();
class PersistenceConflict extends Error {}
jest.mock("@/modules/foundation/foundation-persistence", () => ({
  FoundationPersistenceConflictError: PersistenceConflict,
  deepClone: <T,>(value: T): T => structuredClone(value),
  loadPersistedState: <T,>(input: { namespace: string; seedFactory: () => T }) => {
    const current = persisted.get(input.namespace);
    return current ? { revision: current.revision, state: structuredClone(current.state) as T } : { revision: 0, state: input.seedFactory() };
  },
  savePersistedState: <T,>(input: { namespace: string; state: T; expectedRevision: number }) => {
    persisted.set(input.namespace, { revision: input.expectedRevision + 1, state: structuredClone(input.state) });
    return { revision: input.expectedRevision + 1 };
  },
}));

import {
  appendDispatchRequestOutcome,
  authorizeExactTargetDispatchRequest,
  createExactTargetDispatchFingerprint,
  createOwnerExactTargetDispatchGrant,
  listDispatchRequestReceipts,
  saveExactTargetDispatchPreflight,
} from "../exact-target-dispatch-authority";
import type { GlwCampaign } from "../campaign-types";
import type { GlwCampaignTarget } from "../campaign-target-repository";

const runtimeSha = "a".repeat(40);
const principal = { principalId: "owner@example.test", sessionId: "session-1" };
const campaign = {
  campaignId: "campaign-1", organizationId: "ssi", siteId: "site-1", productId: "product-1",
  name: "Campaign", pageType: "city_service", stateCodes: ["TX"], cityTargets: [{ stateCode: "TX", citySlug: "san-antonio", cityName: "San Antonio" }],
  pagesPerDay: 10, publicationPolicy: "draft_only", imageRequired: true, status: "active", completedTargetCount: 0, failedTargetCount: 0,
  createdAt: "2026-09-13T00:00:00.000Z", updatedAt: "2026-09-13T00:00:00.000Z",
} as GlwCampaign;
const target = {
  targetId: "target-1", campaignId: campaign.campaignId, organizationId: campaign.organizationId, siteId: campaign.siteId,
  productId: campaign.productId, pageType: "city_service", stateCode: "TX", citySlug: "san-antonio", cityName: "San Antonio",
  applicationPath: "product/texas/san-antonio", canonicalPath: "product/texas/san-antonio", publicationPolicy: "draft_only",
  status: "queued", jobId: null, wordpressObjectId: null, attemptCount: 0, lastError: null, leaseId: null, leasedAt: null,
  leaseExpiresAt: null, dispatchDate: null, createdAt: "2026-09-13T00:00:00.000Z", updatedAt: "2026-09-13T00:00:00.000Z",
} as GlwCampaignTarget;
const ready = { releaseAuthorityReady: true, wordpressAuthorityReady: true, mcpReady: true, n8nReady: true, concurrencyReady: true };

function authority(now = new Date("2026-09-13T00:00:00.000Z")) {
  const preflight = saveExactTargetDispatchPreflight({ campaign, target, runtimeSha, principal, dailyAllowanceBefore: 10, readiness: ready, now });
  const grant = createOwnerExactTargetDispatchGrant({ preflightReceiptId: preflight.preflightReceiptId, campaign, target, runtimeSha, principal, confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET", now: new Date(now.getTime() + 1_000) });
  return { preflight, grant };
}

function authorize(overrides: Partial<Parameters<typeof authorizeExactTargetDispatchRequest>[0]> = {}) {
  const { preflight, grant } = authority();
  return authorizeExactTargetDispatchRequest({ preflightReceiptId: preflight.preflightReceiptId, ownerDispatchGrantId: grant.grantId, campaign, target, runtimeSha, principal, confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET", route: "/api/glw/campaigns/campaign-1/scheduler", allowanceBefore: 10, now: new Date("2026-09-13T00:00:02.000Z"), ...overrides });
}

describe("exact target dispatch authority", () => {
  beforeEach(() => persisted.clear());

  test("binds fingerprint to target execution authority", () => {
    const first = createExactTargetDispatchFingerprint({ campaign, target, runtimeSha });
    expect(createExactTargetDispatchFingerprint({ campaign, target: { ...target, status: "running" }, runtimeSha })).not.toBe(first);
    expect(createExactTargetDispatchFingerprint({ campaign, target, runtimeSha: "b".repeat(40) })).not.toBe(first);
    expect(createExactTargetDispatchFingerprint({ campaign: { ...campaign, publicationPolicy: "publish_after_gates" }, target, runtimeSha })).not.toBe(first);
  });

  test("creates a short-lived exact preflight and owner grant then consumes it once", () => {
    const result = authorize();
    expect(result.grant).toMatchObject({ purpose: "OWNER_EXACT_TARGET_DISPATCH", targetId: target.targetId, runtimeSha, consumedByRequestReceiptId: result.requestReceipt.requestReceiptId });
    expect(result.requestReceipt).toMatchObject({ targetId: target.targetId, method: "POST", outcome: "AUTHORIZED", grantValidationResult: "PASS" });
  });

  test("blocks replay", () => {
    const { preflight, grant } = authority();
    const input = { preflightReceiptId: preflight.preflightReceiptId, ownerDispatchGrantId: grant.grantId, campaign, target, runtimeSha, principal, confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET" as const, route: "/route", allowanceBefore: 10, now: new Date("2026-09-13T00:00:02.000Z") };
    authorizeExactTargetDispatchRequest(input);
    expect(() => authorizeExactTargetDispatchRequest(input)).toThrow("OWNER_DISPATCH_GRANT_CONSUMED");
  });

  test.each([
    ["organization", { campaign: { ...campaign, organizationId: "other" } }, "ORGANIZATION"],
    ["site", { campaign: { ...campaign, siteId: "other" } }, "SITE"],
    ["campaign", { campaign: { ...campaign, campaignId: "other" } }, "CAMPAIGN"],
    ["target", { target: { ...target, targetId: "other" } }, "TARGET"],
    ["runtime", { runtimeSha: "b".repeat(40) }, "RUNTIME"],
    ["principal", { principal: { ...principal, sessionId: "other" } }, "PRINCIPAL"],
  ])("blocks wrong %s binding", (_label, override, code) => {
    expect(() => authorize(override as never)).toThrow(code);
  });

  test("blocks stale target state after preflight", () => {
    expect(() => authorize({ target: { ...target, updatedAt: "2026-09-13T00:00:01.000Z" } })).toThrow("FINGERPRINT_STALE");
  });

  test("blocks expired preflight and grant", () => {
    const { preflight, grant } = authority();
    expect(() => authorizeExactTargetDispatchRequest({ preflightReceiptId: preflight.preflightReceiptId, ownerDispatchGrantId: grant.grantId, campaign, target, runtimeSha, principal, confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET", route: "/route", allowanceBefore: 10, now: new Date("2026-09-13T00:06:00.000Z") })).toThrow("PREFLIGHT_EXPIRED");
  });

  test("blocks a missing or expired owner grant", () => {
    const { preflight, grant } = authority();
    const input = { preflightReceiptId: preflight.preflightReceiptId, ownerDispatchGrantId: "missing", campaign, target, runtimeSha, principal, confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET" as const, route: "/route", allowanceBefore: 10, now: new Date("2026-09-13T00:00:02.000Z") };
    expect(() => authorizeExactTargetDispatchRequest(input)).toThrow("OWNER_DISPATCH_GRANT_NOT_FOUND");
    expect(() => authorizeExactTargetDispatchRequest({ ...input, ownerDispatchGrantId: grant.grantId, now: new Date("2026-09-13T00:03:00.000Z") })).toThrow("OWNER_DISPATCH_GRANT_EXPIRED");
  });

  test("blocks an old preflight after a newer exact-target preflight exists", () => {
    const { preflight, grant } = authority();
    saveExactTargetDispatchPreflight({ campaign, target, runtimeSha, principal, dailyAllowanceBefore: 10, readiness: ready, now: new Date("2026-09-13T00:00:01.500Z") });
    expect(() => authorizeExactTargetDispatchRequest({ preflightReceiptId: preflight.preflightReceiptId, ownerDispatchGrantId: grant.grantId, campaign, target, runtimeSha, principal, confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET", route: "/route", allowanceBefore: 10, now: new Date("2026-09-13T00:00:02.000Z") })).toThrow("DISPATCH_PREFLIGHT_SUPERSEDED");
  });

  test("blocks wrong operation and confirmation mode", () => {
    const { preflight, grant } = authority();
    const stored = persisted.get("glw-exact-target-dispatch-authority-v1")!;
    const state = structuredClone(stored.state) as { grants: Array<{ operation: string }> };
    state.grants[0].operation = "WRONG_OPERATION";
    persisted.set("glw-exact-target-dispatch-authority-v1", { revision: stored.revision, state });
    expect(() => authorizeExactTargetDispatchRequest({ preflightReceiptId: preflight.preflightReceiptId, ownerDispatchGrantId: grant.grantId, campaign, target, runtimeSha, principal, confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET", route: "/route", allowanceBefore: 10, now: new Date("2026-09-13T00:00:02.000Z") })).toThrow("OPERATION_MISMATCH");
  });

  test("requires grant creation strictly after preflight and exact confirmation at use", () => {
    const preflight = saveExactTargetDispatchPreflight({ campaign, target, runtimeSha, principal, dailyAllowanceBefore: 10, readiness: ready, now: new Date("2026-09-13T00:00:00.000Z") });
    expect(() => createOwnerExactTargetDispatchGrant({ preflightReceiptId: preflight.preflightReceiptId, campaign, target, runtimeSha, principal, confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET", now: new Date("2026-09-13T00:00:00.000Z") })).toThrow("MUST_FOLLOW_PREFLIGHT");
    const grant = createOwnerExactTargetDispatchGrant({ preflightReceiptId: preflight.preflightReceiptId, campaign, target, runtimeSha, principal, confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET", now: new Date("2026-09-13T00:00:01.000Z") });
    expect(() => authorizeExactTargetDispatchRequest({ preflightReceiptId: preflight.preflightReceiptId, ownerDispatchGrantId: grant.grantId, campaign, target, runtimeSha, principal, confirmationMode: "WRONG" as never, route: "/route", allowanceBefore: 10, now: new Date("2026-09-13T00:00:02.000Z") })).toThrow("CONFIRMATION_MISMATCH");
  });

  test("resolves append-only request outcomes without rewriting base provenance", () => {
    const result = authorize();
    appendDispatchRequestOutcome({ requestReceiptId: result.requestReceipt.requestReceiptId, patch: { releaseAuthorityResult: "PASS", wordpressAuthorityResult: "PASS", mcpPreflightResult: "PASS", leaseId: "lease-1", allowanceAfter: 9, outcome: "LEASED" }, now: new Date("2026-09-13T00:00:03.000Z") });
    expect(listDispatchRequestReceipts()).toEqual([expect.objectContaining({ requestReceiptId: result.requestReceipt.requestReceiptId, leaseId: "lease-1", allowanceBefore: 10, allowanceAfter: 9, outcome: "LEASED" })]);
  });

  test("requires a principal and ready eligible preflight", () => {
    expect(() => saveExactTargetDispatchPreflight({ campaign, target, runtimeSha, principal: { principalId: "", sessionId: "" }, dailyAllowanceBefore: 10, readiness: ready })).toThrow("PRINCIPAL_REQUIRED");
    expect(() => saveExactTargetDispatchPreflight({ campaign, target, runtimeSha, principal, dailyAllowanceBefore: 10, readiness: { ...ready, mcpReady: false } })).toThrow("PREFLIGHT_NOT_READY");
  });
});
