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
    const current = persisted.get(input.namespace);
    if ((current?.revision ?? 0) !== input.expectedRevision) throw new Error("revision conflict");
    const revision = input.expectedRevision + 1;
    persisted.set(input.namespace, { revision, state: structuredClone(input.state) });
    return { revision, state: structuredClone(input.state) };
  },
}));

import {
  initializeGlwCityCampaignTargets,
  prepareGlwCityCampaignTargets,
  summarizeGlwCampaignTargets,
} from "../campaign-target-repository";

const cities = [
  { stateCode: "TX", citySlug: "austin", cityName: "Austin" },
  { stateCode: "TX", citySlug: "dallas", cityName: "Dallas" },
  { stateCode: "TX", citySlug: "houston", cityName: "Houston" },
  { stateCode: "TX", citySlug: "san-antonio", cityName: "San Antonio" },
];

const input = {
  campaignId: "campaign-projector-texas",
  organizationId: "ssi",
  siteId: "site-ssi-projectorenclosure",
  productId: "prod-ssi-fan-cooled-projector-enclosures",
  parentCampaignId: "campaign-projector-california",
  publicationPolicy: "draft_only" as const,
  productSlug: "fan-cooled-projector-enclosures",
  stateSlug: "texas",
  canonicalParentId: null,
  cityTargets: cities,
};

describe("GLW durable draft target preparation", () => {
  beforeEach(() => persisted.clear());

  test("prepares exactly four non-executable canonical targets with full lineage", () => {
    const targets = prepareGlwCityCampaignTargets(input);
    expect(targets).toHaveLength(4);
    expect(targets.every((target) =>
      target.status === "prepared"
      && target.pageType === "city_service"
      && target.parentCampaignId === input.parentCampaignId
      && target.publicationPolicy === "draft_only"
      && target.jobId === null
      && target.wordpressObjectId === null
      && target.leaseId === null
      && target.dispatchDate === null
      && target.applicationPath === target.canonicalPath,
    )).toBe(true);
    expect(targets.map((target) => target.canonicalPath)).toEqual([
      "fan-cooled-projector-enclosures/texas/austin",
      "fan-cooled-projector-enclosures/texas/dallas",
      "fan-cooled-projector-enclosures/texas/houston",
      "fan-cooled-projector-enclosures/texas/san-antonio",
    ]);
    expect(summarizeGlwCampaignTargets(input.campaignId)).toMatchObject({ total: 4, prepared: 4, queued: 0, running: 0 });
  });

  test("is idempotent and rejects ownership by another campaign", () => {
    expect(prepareGlwCityCampaignTargets(input)).toHaveLength(4);
    expect(prepareGlwCityCampaignTargets(input)).toHaveLength(4);
    expect(() => prepareGlwCityCampaignTargets({ ...input, campaignId: "campaign-other" }))
      .toThrow("already owned");
  });

  test("converts prepared targets only when canonical activation initializes the queue", () => {
    prepareGlwCityCampaignTargets(input);
    const targets = initializeGlwCityCampaignTargets({
      campaignId: input.campaignId,
      organizationId: input.organizationId,
      siteId: input.siteId,
      productId: input.productId,
      cityTargets: cities,
      referenceTarget: { stateCode: "TX", citySlug: "austin" },
      referenceJobId: "job-reference",
      referenceWordpressObjectId: "401",
    });
    expect(targets.filter((target) => target.status === "reference_complete")).toHaveLength(1);
    expect(targets.filter((target) => target.status === "queued")).toHaveLength(3);
    expect(targets.filter((target) => target.status === "prepared")).toHaveLength(0);
  });
});
