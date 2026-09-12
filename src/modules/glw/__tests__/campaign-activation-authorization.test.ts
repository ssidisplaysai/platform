jest.mock("server-only", () => ({}));

const persisted = new Map<string, { revision: number; state: unknown }>();
class PersistenceConflict extends Error {}

jest.mock("@/modules/foundation/foundation-persistence", () => ({
  FoundationPersistenceConflictError: PersistenceConflict,
  deepClone: <T,>(value: T): T => structuredClone(value),
  loadPersistedState: <T,>(input: { namespace: string; seedFactory: () => T }) => {
    const current = persisted.get(input.namespace);
    if (current) return { revision: current.revision, state: structuredClone(current.state) as T };
    const state = input.seedFactory();
    persisted.set(input.namespace, { revision: 0, state: structuredClone(state) });
    return { revision: 0, state };
  },
  savePersistedState: <T,>(input: { namespace: string; state: T; expectedRevision: number }) => {
    const current = persisted.get(input.namespace);
    if ((current?.revision ?? 0) !== input.expectedRevision) throw new PersistenceConflict();
    const revision = input.expectedRevision + 1;
    persisted.set(input.namespace, { revision, state: structuredClone(input.state) });
    return { revision, state: structuredClone(input.state) };
  },
}));

import type { GlwCampaign } from "../campaign-types";
import type { GlwCampaignTarget } from "../campaign-target-repository";
import {
  claimGlwCampaignActivationGrant,
  consumeGlwCampaignActivationGrant,
  createGlwCampaignActivationGrant,
  createGlwCampaignTargetFingerprint,
  listGlwCampaignActivationGrants,
} from "../campaign-activation-authorization";

const release = "a".repeat(40);
const now = new Date("2030-01-01T00:00:00.000Z");
const campaign: GlwCampaign = {
  campaignId: "campaign-projector-texas", organizationId: "ssi", siteId: "site-projector",
  productId: "product-enclosure", name: "Projector Texas", pageType: "city_service", stateCodes: ["TX"],
  cityTargets: [{ stateCode: "TX", citySlug: "austin", cityName: "Austin" }], pagesPerDay: 10,
  publicationPolicy: "draft_only", imageRequired: true, status: "draft", completedTargetCount: 0,
  failedTargetCount: 0, createdAt: now.toISOString(), updatedAt: now.toISOString(),
};
const target: GlwCampaignTarget = {
  targetId: "target-projector-austin", campaignId: campaign.campaignId, organizationId: campaign.organizationId,
  siteId: campaign.siteId, productId: campaign.productId, pageType: "city_service", stateCode: "TX",
  citySlug: "austin", cityName: "Austin", applicationPath: "fan-cooled-projector-enclosures/texas/austin",
  canonicalPath: "fan-cooled-projector-enclosures/texas/austin", canonicalParentId: null,
  parentCampaignId: null, publicationPolicy: "draft_only", status: "prepared", jobId: null,
  wordpressObjectId: null, attemptCount: 0, lastError: null, leaseId: null, leasedAt: null,
  leaseExpiresAt: null, dispatchDate: null, createdAt: now.toISOString(), updatedAt: now.toISOString(),
};
const referenceApproval = {
  receiptSha256: "b".repeat(64),
  referenceRevision: 1,
  imageCandidateId: "reference-image-1",
  imageCandidateRevision: 1,
};

function createGrant(overrides: Partial<Parameters<typeof createGlwCampaignActivationGrant>[0]> = {}) {
  return createGlwCampaignActivationGrant({
    campaign,
    targets: [target],
    certifiedReleaseSha: release,
    referenceApproval,
    expiresAt: "2030-01-01T00:15:00.000Z",
    createdBy: "platform_admin",
    now,
    createNonce: () => "12345678-1234-4234-8234-123456789abc",
    ...overrides,
  });
}

function claim(overrides: Partial<Parameters<typeof claimGlwCampaignActivationGrant>[0]> = {}) {
  return claimGlwCampaignActivationGrant({
    campaign,
    targets: [target],
    certifiedReleaseSha: release,
    referenceApproval,
    claimedBy: "platform_admin",
    now: new Date("2030-01-01T00:01:00.000Z"),
    ...overrides,
  });
}

describe("campaign-scoped activation authorization", () => {
  beforeEach(() => persisted.clear());

  test("binds exact target identity, policy, release, expiry, nonce, purpose, and actor", () => {
    const grant = createGrant();
    expect(grant).toMatchObject({
      purpose: "ACTIVATE_ONLY", organizationId: campaign.organizationId, siteId: campaign.siteId,
      campaignId: campaign.campaignId, publicationPolicy: "draft_only", certifiedReleaseSha: release,
      referenceApprovalReceiptSha256: referenceApproval.receiptSha256,
      referenceRevision: 1,
      imageCandidateId: "reference-image-1",
      imageRevision: 1,
      expiresAt: "2030-01-01T00:15:00.000Z", createdBy: "platform_admin", consumedAt: null,
    });
    expect(grant.targetFingerprint).toBe(createGlwCampaignTargetFingerprint(campaign, [target]));
    expect(grant.nonce).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test("grant for campaign A cannot authorize campaign B", () => {
    createGrant();
    const otherCampaign = { ...campaign, campaignId: "campaign-other" };
    const otherTarget = { ...target, campaignId: otherCampaign.campaignId };
    expect(() => claim({ campaign: otherCampaign, targets: [otherTarget] })).toThrow("ACTIVATION_GRANT_INVALID");
  });

  test("fails closed for cross-organization and cross-site identities", () => {
    createGrant();
    const otherOrg = { ...campaign, organizationId: "other" };
    expect(() => claim({ campaign: otherOrg, targets: [{ ...target, organizationId: "other" }] }))
      .toThrow("ACTIVATION_GRANT_ORGANIZATION_MISMATCH");
    const otherSite = { ...campaign, siteId: "site-other" };
    expect(() => claim({ campaign: otherSite, targets: [{ ...target, siteId: "site-other" }] }))
      .toThrow("ACTIVATION_GRANT_SITE_MISMATCH");
  });

  test("fails closed when target membership or canonical identity changes", () => {
    createGrant();
    expect(() => claim({ targets: [{ ...target, canonicalPath: "fan-cooled-projector-enclosures/texas/dallas" }] }))
      .toThrow("ACTIVATION_GRANT_TARGET_FINGERPRINT_MISMATCH");
  });

  test("fails closed when publication policy or release changes", () => {
    createGrant();
    expect(() => claim({ campaign: { ...campaign, publicationPolicy: "publish_after_gates" } }))
      .toThrow("ACTIVATION_GRANT_PUBLICATION_POLICY_MISMATCH");
    expect(() => claim({ certifiedReleaseSha: "b".repeat(40) })).toThrow("ACTIVATION_GRANT_RELEASE_MISMATCH");
  });

  test("fails closed when the approved reference or image revision changes", () => {
    createGrant();
    expect(() => claim({ referenceApproval: { ...referenceApproval, referenceRevision: 2 } }))
      .toThrow("ACTIVATION_GRANT_REFERENCE_APPROVAL_MISMATCH");
    expect(() => claim({ referenceApproval: { ...referenceApproval, imageCandidateRevision: 2 } }))
      .toThrow("ACTIVATION_GRANT_REFERENCE_APPROVAL_MISMATCH");
  });

  test("fails closed for expired and malformed grants", () => {
    createGrant();
    expect(() => claim({ now: new Date("2030-01-01T00:16:00.000Z") })).toThrow("ACTIVATION_GRANT_EXPIRED");
    const state = persisted.values().next().value as { revision: number; state: { grants: Array<{ nonce: string }> } };
    state.state.grants[0].nonce = "malformed";
    expect(() => claim()).toThrow("ACTIVATION_GRANT_INVALID");
  });

  test("claim is atomic and consumed grants cannot be replayed", () => {
    const grant = createGrant();
    const claimed = claim();
    expect(() => claim()).toThrow("ACTIVATION_GRANT_ALREADY_CLAIMED");
    const consumed = consumeGlwCampaignActivationGrant({
      grantId: grant.grantId,
      claimId: claimed.claimId,
      consumedBy: "platform_admin",
      now: new Date("2030-01-01T00:02:00.000Z"),
    });
    expect(consumed).toMatchObject({ consumedBy: "platform_admin", consumedAt: "2030-01-01T00:02:00.000Z" });
    expect(() => claim()).toThrow("ACTIVATION_GRANT_CONSUMED");
  });

  test("no grant means no global fallback", () => {
    expect(() => claim()).toThrow("ACTIVATION_GRANT_INVALID");
    expect(listGlwCampaignActivationGrants(campaign.campaignId)).toEqual([]);
  });
});
