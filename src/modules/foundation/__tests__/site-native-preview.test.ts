import { deriveNativePreviewTokens, pageWordCount, safeText, sectionParagraphs } from "../site-native-preview";
import type { CreativeDirectionProposal, SiteStrategyProposal } from "../site-intelligence";
import type { SiteAssemblyProposal } from "../site-page-generation";

const strategy = {
  revision: 3,
  positioning: "Website development and search growth.",
  primaryAudience: "SMBs",
  secondaryAudiences: [],
  valueProposition: "Grow local demand.",
  majorVerticals: [],
  productServiceFamilies: [],
  informationArchitecture: [],
  proposedSitemap: [],
  homepageGoals: [],
  conversionPaths: [],
  ctaHierarchy: [],
  trustProofRequirements: [],
  geographicStrategy: "",
  proposedProductAuthority: [],
  status: "APPROVED",
  reason: "",
  createdBy: "owner",
  createdAt: "now",
  decidedBy: "owner",
  decidedAt: "now",
} as SiteStrategyProposal;

const creative = {
  revision: 2,
  strategyRevision: 3,
  overallDirection: "Dark navy modern technology aesthetic.",
  brandInterpretation: "Premium SaaS style.",
  colorDirection: "Dark navy with cyan and electric blue accents.",
  typographyDirection: "Modern sans-serif typography.",
  spacingLayoutDirection: "",
  photographyStyle: "",
  generatedImageStyle: "",
  heroTreatment: "Confident dark hero with clear CTA.",
  ctaTreatment: "",
  trustProofPresentation: "",
  productPresentation: "",
  verticalPresentation: "",
  mobileConsiderations: "",
  visualDos: [],
  visualDonts: [],
  homepageBlueprint: [],
  imagePlan: [],
  status: "APPROVED",
  reason: "",
  createdBy: "owner",
  createdAt: "now",
  decidedBy: "owner",
  decidedAt: "now",
} as CreativeDirectionProposal;

describe("site native preview helpers", () => {
  test("derives dark technology tokens from approved creative direction", () => {
    const tokens = deriveNativePreviewTokens({ strategy, creative });
    expect(tokens.background).toBe("#06142b");
    expect(tokens.accent).toBe("#22d3ee");
    expect(tokens.textPrimary).toBe("#ecfeff");
  });

  test("sanitizes unsafe html and script strings", () => {
    expect(safeText("<script>alert(1)</script><b>Hello</b> world")).toBe("alert(1) Hello world");
  });

  test("parses step presentation into paragraph entries", () => {
    const parsed = sectionParagraphs({
      sectionId: "s",
      heading: "How It Works",
      level: 2,
      body: ["1. Target Your Area 2. Build Local Pages 3. Optimize for Search 4. Track and Grow"],
      presentation: "STEPS",
    });
    expect(parsed).toEqual(expect.arrayContaining(["Target Your Area", "Build Local Pages", "Optimize for Search", "Track and Grow"]));
  });

  test("computes word counts from structured page content", () => {
    const page = {
      h1: "Contact",
      metaDescription: "Book a consultation.",
      sections: [
        { sectionId: "a", heading: "What to Share", level: 2, body: ["Tell us your goals."], presentation: "PROSE" },
        { sectionId: "b", heading: "Next Step", level: 2, body: ["Book a Consultation."], presentation: "CTA" },
      ],
    } as SiteAssemblyProposal["pages"][number];
    expect(pageWordCount(page)).toBeGreaterThan(5);
  });
});
