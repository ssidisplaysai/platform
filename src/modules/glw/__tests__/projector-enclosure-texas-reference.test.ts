jest.mock("server-only", () => ({}));

const persisted = new Map<string, { revision: number; state: unknown }>();
jest.mock("@/modules/foundation/foundation-persistence", () => ({
  deepClone: <T,>(value: T): T => structuredClone(value),
  loadPersistedState: <T,>(input: { namespace: string; seedFactory: () => T }) => {
    const current = persisted.get(input.namespace);
    if (current) return { revision: current.revision, state: structuredClone(current.state) as T };
    const state = input.seedFactory();
    persisted.set(input.namespace, { revision: 0, state: structuredClone(state) });
    return { revision: 0, state };
  },
  savePersistedState: <T,>(input: { namespace: string; state: T; expectedRevision: number }) => {
    const revision = input.expectedRevision + 1;
    persisted.set(input.namespace, { revision, state: structuredClone(input.state) });
    return { revision, state: structuredClone(input.state) };
  },
}));

import type { GlwCampaign } from "../campaign-types";
import type { GlwCampaignKnowledgePack } from "../campaign-reference-types";
import { getGlwLocalReferenceDraft, requestGlwLocalReferenceChanges, saveGlwLocalReferenceDraft } from "../campaign-local-reference-repository";
import { buildProjectorEnclosureAustinReference, buildProjectorEnclosureTexasKnowledgePack, PROJECTOR_TEXAS_PARENT_CAMPAIGN_ID, selectDeterministicCityReference } from "../projector-enclosure-texas-reference";

const campaign: GlwCampaign = {
  campaignId: "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-cities",
  organizationId: "ssi", siteId: "site-ssi-projectorenclosure", productId: "prod-ssi-fan-cooled-projector-enclosures",
  name: "Fan Cooled Projector Enclosures Texas Cities", pageType: "city_service", stateCodes: ["TX"],
  cityTargets: [
    { stateCode: "TX", citySlug: "san-antonio", cityName: "San Antonio" },
    { stateCode: "TX", citySlug: "houston", cityName: "Houston" },
    { stateCode: "TX", citySlug: "dallas", cityName: "Dallas" },
    { stateCode: "TX", citySlug: "austin", cityName: "Austin" },
  ],
  pagesPerDay: 10, publicationPolicy: "draft_only", imageRequired: true, status: "draft",
  completedTargetCount: 0, failedTargetCount: 0, parentCampaignId: PROJECTOR_TEXAS_PARENT_CAMPAIGN_ID,
  createdAt: "2030-01-01", updatedAt: "2030-01-01",
};
const parentPack: GlwCampaignKnowledgePack = {
  campaignId: PROJECTOR_TEXAS_PARENT_CAMPAIGN_ID, organizationId: "ssi", siteId: campaign.siteId,
  instructions: "Approved parent product and editorial guidance.", references: [], updatedAt: "2030-01-01",
};

describe("ProjectorEnclosure Texas local reference", () => {
  beforeEach(() => persisted.clear());

  test("selects Austin deterministically independent of stored target order", () => {
    expect(selectDeterministicCityReference(campaign)).toMatchObject({ stateCode: "TX", citySlug: "austin", cityName: "Austin" });
  });

  test("builds a Texas-only governed pack from stable parent authority", () => {
    const pack = buildProjectorEnclosureTexasKnowledgePack({ campaign, parentPack });
    expect(pack.instructions).toContain("Austin, Dallas, Houston, and San Antonio");
    expect(pack.instructions).toContain("Never invent customers");
    expect(pack.authorityReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "parent_campaign", scope: "guidance" }),
      expect.objectContaining({ sourceType: "product", scope: "stable_fact" }),
      expect.objectContaining({ sourceType: "approved_reference", scope: "quality_evidence" }),
    ]));
  });

  test("generates review-ready Austin copy without California claims, placeholders, or governance prose", () => {
    const synthesized = buildProjectorEnclosureTexasKnowledgePack({ campaign, parentPack });
    const knowledgePack = { ...parentPack, campaignId: campaign.campaignId, revision: 1, instructions: synthesized.instructions, authorityReferences: synthesized.authorityReferences };
    const reference = buildProjectorEnclosureAustinReference({ campaign, knowledgePack });
    const customerCopy = JSON.stringify({ title: reference.title, seoTitle: reference.seoTitle, metaDescription: reference.metaDescription, h1: reference.h1, excerpt: reference.excerpt, sections: reference.sections });
    expect(customerCopy).toContain("Austin");
    expect(customerCopy).toContain("Texas");
    expect(customerCopy).not.toMatch(/California|\[CITY\]|governance|authority|workflow|prompt/i);
    expect(reference.internalLinks).toHaveLength(4);
    expect(reference.internalLinks.every((link) => link.url.startsWith("https://projectorenclosure.com/"))).toBe(true);
    expect(reference.image).toMatchObject({ required: true, status: "OWNER_ASSET_CANDIDATE", classification: "OWNER_ASSET", ownerApproved: false });
  });

  test("persists revisions and owner change requests without canonical approval", () => {
    const synthesized = buildProjectorEnclosureTexasKnowledgePack({ campaign, parentPack });
    const knowledgePack = { ...parentPack, campaignId: campaign.campaignId, revision: 1, instructions: synthesized.instructions, authorityReferences: synthesized.authorityReferences };
    const first = saveGlwLocalReferenceDraft(buildProjectorEnclosureAustinReference({ campaign, knowledgePack }));
    const second = saveGlwLocalReferenceDraft(buildProjectorEnclosureAustinReference({ campaign, knowledgePack }));
    expect(first).toMatchObject({ revision: 1, status: "READY_FOR_OWNER_REVIEW" });
    expect(second).toMatchObject({ revision: 2, status: "READY_FOR_OWNER_REVIEW" });
    const changed = requestGlwLocalReferenceChanges({ campaignId: campaign.campaignId, stateCode: "TX", citySlug: "austin", instructions: "Clarify the fit-review CTA." });
    expect(changed).toMatchObject({ revision: 2, status: "CHANGES_REQUESTED", reviewInstructions: "Clarify the fit-review CTA." });
    expect(getGlwLocalReferenceDraft(campaign.campaignId, "TX", "austin")?.status).toBe("CHANGES_REQUESTED");
  });
});
