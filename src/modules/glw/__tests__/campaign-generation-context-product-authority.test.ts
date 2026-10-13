jest.mock("server-only", () => ({}));

const mockGetPack = jest.fn();
const mockListCampaigns = jest.fn();
const mockResolveProductAuthority = jest.fn();

jest.mock("../campaign-reference-repository", () => ({
  getGlwCampaignKnowledgePack: (...args: unknown[]) => mockGetPack(...args),
}));

jest.mock("../campaign-repository", () => ({
  listGlwCampaigns: (...args: unknown[]) => mockListCampaigns(...args),
}));

jest.mock("../site-internal-link-authority", () => ({
  resolveGlwProductAuthority: (...args: unknown[]) => mockResolveProductAuthority(...args),
}));

import { resolveGlwCampaignGenerationContext } from "../campaign-generation-context";

describe("campaign generation context product authority binding", () => {
  beforeEach(() => {
    mockGetPack.mockReturnValue({
      instructions: "Use approved references only.",
      references: [],
    });
    mockListCampaigns.mockReturnValue([
      {
        campaignId: "campaign-fan",
        organizationId: "ssi",
        siteId: "site-ssi-projectorenclosure",
        productId: "prod-ssi-fan-cooled-projector-enclosures",
      },
    ]);
    mockResolveProductAuthority.mockReturnValue({
      path: "/fan-cooled-projector-enclosures/",
      anchorText: "Fan Cooled Projector Enclosures",
    });
  });

  test("serializes required product link from campaign product authority", () => {
    const resolved = resolveGlwCampaignGenerationContext({
      campaignId: "campaign-fan",
      referencePage: true,
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.claimContract.requiredProductLink).toEqual({
      anchorText: "Fan Cooled Projector Enclosures",
      href: "/fan-cooled-projector-enclosures/",
    });
    expect(resolved?.additionalInstructions).toContain(
      "REQUIRED PRODUCT LINK: Fan Cooled Projector Enclosures -> /fan-cooled-projector-enclosures/",
    );
    expect(resolved?.additionalInstructions).not.toContain("Outdoor Digital Sphere");
  });

  test("fails closed when canonical product authority cannot be resolved", () => {
    mockResolveProductAuthority.mockReturnValue(null);

    const resolved = resolveGlwCampaignGenerationContext({
      campaignId: "campaign-fan",
      referencePage: true,
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.claimContract.requiredProductLink).toBeNull();
    expect(resolved?.additionalInstructions).toContain("REQUIRED PRODUCT LINK: NONE");
  });
});
