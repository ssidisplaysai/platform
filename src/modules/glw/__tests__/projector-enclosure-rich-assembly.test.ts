import { readFileSync } from "node:fs";
import { join } from "node:path";

import { evaluateGlwReferenceClaimAuthority } from "../reference-claim-authority";
import { canonicalizeGlwZeroAuthorityClaims } from "../zero-authority-claim-canonicalization";
import {
  assembleProjectorEnclosureRichReference,
  buildProjectorEnclosureVisualPlan,
  SSI_FAN_COOLED_PROJECTOR_PRODUCT_ID,
} from "../projector-enclosure-rich-assembly";
import { evaluateProjectorEnclosurePresentation } from "../projector-enclosure-presentation-authority";

describe("projector enclosure quality pass v1", () => {
  const artifact = {
    title: "Fan Cooled Projector Enclosures in Arlington",
    contentHtml: [
      "<h1>Fan Cooled Projector Enclosures in Arlington</h1>",
      "<h2>Applications</h2>",
      "<p>Projection mapping and event environments can be considered when teams confirm equipment and site conditions.</p>",
      "<p>Hospitality and outdoor theater projects may evaluate fan-cooled enclosure options for covered or mild environments.</p>",
      "<ul><li>Confirm projector model and lens clearance.</li><li>Confirm mounting direction and service access.</li></ul>",
      "<p><a href=\"https://projectorenclosure.com/fan-cooled-projector-enclosures/\">Fan Cooled Projector Enclosures</a></p>",
      "<p>Request a quote after fit inputs are documented.</p>",
    ].join("\n"),
    slug: "fan-cooled-projector-enclosures/texas/arlington",
    excerpt: "Planning guidance for fan-cooled projector enclosures.",
    seoTitle: "Fan Cooled Projector Enclosures in Arlington",
    metaDescription: "Plan fan-cooled projector enclosures in Arlington.",
    focusKeyphrase: "fan cooled projector enclosures arlington",
  } as const;

  test("Fan Cooled visual plan prefers outdoor mapping/theater/event imagery", () => {
    const plan = buildProjectorEnclosureVisualPlan({
      productId: SSI_FAN_COOLED_PROJECTOR_PRODUCT_ID,
      pageType: "city_service",
    });
    expect(plan).not.toBeNull();
    const intents = plan!.visuals.map((item) => item.intent);
    expect(intents).toEqual(expect.arrayContaining([
      "OUTDOOR_MAPPING",
      "OUTDOOR_THEATER_HOSPITALITY",
      "OUTDOOR_COMMERCIAL_EVENT",
    ]));
  });

  test("Fan Cooled visual plan limits indoor supporting imagery", () => {
    const plan = buildProjectorEnclosureVisualPlan({
      productId: SSI_FAN_COOLED_PROJECTOR_PRODUCT_ID,
      pageType: "city_service",
    });
    expect(plan?.bodyIndoorMaximumCount).toBe(1);
    expect(plan?.visuals.filter((item) => item.environment === "INDOOR" && item.placement === "BODY")).toHaveLength(1);
  });

  test("Hero may remain product-forward", () => {
    const plan = buildProjectorEnclosureVisualPlan({
      productId: SSI_FAN_COOLED_PROJECTOR_PRODUCT_ID,
      pageType: "state_service",
    });
    expect(plan?.heroProductForwardAllowed).toBe(true);
  });

  test("Body assembly supports visual sections instead of a text-only article wall", () => {
    const plan = buildProjectorEnclosureVisualPlan({ productId: SSI_FAN_COOLED_PROJECTOR_PRODUCT_ID, pageType: "city_service" })!;
    const assembled = assembleProjectorEnclosureRichReference({
      artifact: { ...artifact },
      productTopic: "Fan Cooled Projector Enclosures",
      stateName: "Texas",
      cityName: "Arlington",
      visualPlan: plan,
      productImageUrl: "https://projectorenclosure.com/wp-content/uploads/2024/03/Integrator-scaled-1.webp",
      outdoorVisualUrl: "https://projectorenclosure.com/wp-content/uploads/2026/09/generated-outdoor-visual.jpg",
      indoorVisualUrl: "https://projectorenclosure.com/wp-content/uploads/2026/09/generated-indoor-support.jpg",
      canonicalProductHref: "https://projectorenclosure.com/fan-cooled-projector-enclosures/",
    });
    expect(assembled.contentHtml).toContain('data-reference-section="HERO"');
    expect(assembled.contentHtml).toContain('data-reference-section="PRODUCT_IDENTITY"');
    expect(assembled.contentHtml).toContain('data-reference-section="VISUAL_APPLICATION"');
    expect((assembled.contentHtml.match(/<section\b/gi) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  test("ProjectorEnclosure presentation authority remains controlling", () => {
    const plan = buildProjectorEnclosureVisualPlan({ productId: SSI_FAN_COOLED_PROJECTOR_PRODUCT_ID, pageType: "state_service" })!;
    const assembled = assembleProjectorEnclosureRichReference({
      artifact: { ...artifact },
      productTopic: "Fan Cooled Projector Enclosures",
      stateName: "Texas",
      cityName: null,
      visualPlan: plan,
      productImageUrl: "https://projectorenclosure.com/wp-content/uploads/2024/03/Integrator-scaled-1.webp",
      outdoorVisualUrl: "https://projectorenclosure.com/wp-content/uploads/2026/09/generated-outdoor-visual.jpg",
      canonicalProductHref: "https://projectorenclosure.com/fan-cooled-projector-enclosures/",
    });
    const evaluation = evaluateProjectorEnclosurePresentation(assembled.contentHtml);
    expect(evaluation.ok).toBe(true);
  });

  test("Unsupported product capability statements fail protected-claim QA", () => {
    const result = evaluateGlwReferenceClaimAuthority({
      artifact: {
        ...artifact,
        contentHtml: "<p>Active cooling benefits improve equipment longevity in Texas temperature swings and prevent overheating.</p>",
      },
      authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] },
    });
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.authorityStatus === "UNSUPPORTED")).toBe(true);
  });

  test("Buyer-question fallback canonicalization works", () => {
    const rawArtifact = {
      ...artifact,
      contentHtml: "<p>This allows for interactive content control across the venue.</p>",
    };
    const findings = evaluateGlwReferenceClaimAuthority({
      artifact: rawArtifact,
      authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] },
    }).findings;
    const canonicalized = canonicalizeGlwZeroAuthorityClaims({
      rawArtifact,
      authoritativeFactReferenceIds: [],
      findings,
      fallbackPolicy: "STRICT",
      authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] },
    });
    expect(canonicalized.ok).toBe(true);
    expect(canonicalized.canonicalizedArtifact?.contentHtml).toMatch(/\?/);
  });

  test("Valid supported facts remain allowed", () => {
    const statement = "The approved product information identifies built-in fan cooling.";
    const result = evaluateGlwReferenceClaimAuthority({
      artifact: { ...artifact, contentHtml: `<p>${statement}</p>` },
      authority: {
        references: [{ referenceId: "fact-1", role: "authoritative_fact" }],
        authoritativeFactReferenceIds: ["fact-1"],
        supportedClaimMappings: [{ authoritativeFactReferenceId: "fact-1", claimClass: "PRODUCT_CAPABILITY", supportedAssertion: statement }],
      },
    });
    expect(result.ok).toBe(true);
  });

  test("Other product families are not forced into Fan Cooled visual rules", () => {
    const plan = buildProjectorEnclosureVisualPlan({
      productId: "prod-other-family",
      pageType: "state_service",
    });
    expect(plan).toBeNull();
  });

  test("Canonical links and SEO structure remain intact in assembled artifact", () => {
    const plan = buildProjectorEnclosureVisualPlan({ productId: SSI_FAN_COOLED_PROJECTOR_PRODUCT_ID, pageType: "city_service" })!;
    const assembled = assembleProjectorEnclosureRichReference({
      artifact: { ...artifact },
      productTopic: "Fan Cooled Projector Enclosures",
      stateName: "Texas",
      cityName: "Arlington",
      visualPlan: plan,
      productImageUrl: "https://projectorenclosure.com/wp-content/uploads/2024/03/Integrator-scaled-1.webp",
      outdoorVisualUrl: "https://projectorenclosure.com/wp-content/uploads/2026/09/generated-outdoor-visual.jpg",
      canonicalProductHref: "https://projectorenclosure.com/fan-cooled-projector-enclosures/",
    });
    expect(assembled.title).toBe(artifact.title);
    expect(assembled.slug).toBe(artifact.slug);
    expect(assembled.contentHtml).toContain('href="https://projectorenclosure.com/fan-cooled-projector-enclosures/"');
  });

  test("Draft-only publication remains intact in campaign generation form", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/campaign-production-generation.ts"), "utf8");
    expect(source).toContain('form.publicationIntent = "draft"');
  });

  test("No publication behavior changes were introduced in page-generation route", () => {
    const source = readFileSync(join(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    expect(source).not.toContain('publicationIntent = "publish"');
  });
});
