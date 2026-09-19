import { createHash } from "node:crypto";
import { evaluateGlwReferenceClaimAuthority, type GlwClaimAuthorityFinding, type GlwReferenceClaimClass } from "../reference-claim-authority";
import {
  canonicalizeGlwZeroAuthorityClaims,
  GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_FINGERPRINT,
  GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION,
  type GlwZeroAuthorityFallbackPolicy,
  rehabilitateGlwExistingArtifact,
} from "../zero-authority-claim-canonicalization";
import { evaluateGlwStateLocalizationContamination } from "../state-localization-contamination";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function artifact(contentHtml: string) {
  return { title: "Test", contentHtml, slug: "outdoor-digital-sphere/indiana", excerpt: null, seoTitle: null, metaDescription: null, focusKeyphrase: null };
}

function finding(claimClass: GlwReferenceClaimClass, claimText: string): GlwClaimAuthorityFinding {
  return { claimClass, claimText, authoritySource: null, authorityStatus: "UNSUPPORTED", authorityKind: "UNSUPPORTED", predicateId: `unsupportedClaim.${claimClass}` };
}

function supportedFinding(claimClass: GlwReferenceClaimClass, claimText: string): GlwClaimAuthorityFinding {
  return { claimClass, claimText, authoritySource: "approved-authority", authorityStatus: "SUPPORTED", authorityKind: "REFERENCE_SUPPORTED", predicateId: `supportedClaim.${claimClass}` };
}

function canonicalize(
  contentHtml: string,
  findings: readonly GlwClaimAuthorityFinding[],
  options?: {
    fallbackPolicy?: GlwZeroAuthorityFallbackPolicy;
  },
) {
  return canonicalizeGlwZeroAuthorityClaims({
    rawArtifact: artifact(contentHtml),
    authoritativeFactReferenceIds: [],
    findings,
    fallbackPolicy: options?.fallbackPolicy,
  });
}

describe("GLW zero-authority deterministic claim canonicalization", () => {
  test.each([
    ["PRODUCT_CAPABILITY", "The system supports interactive content.", "CONVERT_TO_BUYER_QUESTION"],
    ["INTERACTIVITY", "The sphere provides interactive experiences.", "CONVERT_TO_BUYER_QUESTION"],
    ["CLIMATE", "Indiana climate conditions affect operation.", "CONVERT_TO_BUYER_QUESTION"],
    ["WARRANTY", "The product includes a five-year warranty.", "CONVERT_TO_BUYER_QUESTION"],
    ["PRICING", "The product has a lower operating cost.", "CONVERT_TO_BUYER_QUESTION"],
    ["MARKET_ADOPTION", "Regional adoption and popularity continue to grow.", "REMOVE"],
  ] as const)("canonicalizes unsupported %s", (claimClass, text, disposition) => {
    const result = canonicalize(`<p>${text}</p>`, [finding(claimClass, text)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations[0]).toMatchObject({ disposition, safeToTransform: true });
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain(text);
  });

  test("converts a labeled interactive application without asserting capability", () => {
    const text = "Entertainment Zones: Interactive experiences at music festivals.";
    const result = canonicalize(`<ul><li>${text}</li></ul>`, [finding("INTERACTIVITY", text)]);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toContain("One possible concept a project team could consider");
    const qa = evaluateGlwReferenceClaimAuthority({ artifact: result.canonicalizedArtifact!, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
    expect(qa.ok).toBe(true);
  });

  test("removes a nonessential unsupported local fact", () => {
    const text = "Indiana is home to a dense calendar of events.";
    const result = canonicalize(`<h2>Why Consider This Format?</h2><p>${text}</p><p>What project goals should the team define?</p>`, [finding("LOCATION_FACT", text)]);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain(text);
    expect(result.canonicalizedArtifact?.contentHtml).toContain("What project goals");
  });

  test("removes nonessential product assumptions and replaces an unsupported comparison table", () => {
    const contentQuestion = "Which content production approaches work best for a wraparound, curved display with multidirectional viewing?";
    const mistake = "Underestimating the importance of content planning for a curved, multidirectional display surface.";
    const comparison = "Consideration Outdoor Digital Sphere Conventional LED Panel Visual Form Factor Spherical, multidirectional Flat, directional .";
    const cell = "Spherical, multidirectional";
    const result = canonicalize(`<h2>Selection Guidance</h2><ul><li>${contentQuestion}</li></ul><h2>Comparison Table</h2><table><tr><th>Consideration</th><th>Outdoor Digital Sphere</th><th>Conventional LED Panel</th></tr><tr><td>Visual Form Factor</td><td>${cell}</td><td>Flat, directional</td></tr></table><h2>Common Mistakes</h2><ul><li>${mistake}</li></ul><h2>Next Step</h2><p>What project goals should the team document?</p>`, [finding("PRODUCT_SPECIFICATION", contentQuestion), finding("PRODUCT_SPECIFICATION", comparison), finding("PRODUCT_SPECIFICATION", mistake), finding("PRODUCT_SPECIFICATION", cell)]);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain(contentQuestion);
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain(mistake);
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain("Conventional LED Panel");
    expect(result.canonicalizedArtifact?.contentHtml).toContain("Buyer evaluation framework");
    expect(result.canonicalizedArtifact?.contentHtml).toContain("What viewing directions and distances");
  });

  test("replaces structurally identified comparisons without preserving relative claims", () => {
    const comparison = "Feature Curved Display Flat Display Form Factor Curved surface Flat surface Viewing Directions Multiple directions Front-facing Audience Engagement 360-degree audience engagement Standard engagement .";
    const engagement = "360-degree audience engagement";
    const result = canonicalize(`<h2>Product Comparison</h2><table><tr><th>Feature</th><th>Curved Display</th><th>Flat Display</th></tr><tr><td>Form Factor</td><td>Curved surface</td><td>Flat surface</td></tr><tr><td>Viewing Directions</td><td>Multiple directions</td><td>Front-facing</td></tr><tr><td>Audience Engagement</td><td>${engagement}</td><td>Standard engagement</td></tr></table>`, [finding("PRODUCT_SPECIFICATION", comparison), finding("PRODUCT_SPECIFICATION", engagement)]);

    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "UNSUPPORTED_STRUCTURED_COMPARISON_TO_BUYER_EVALUATION_FRAMEWORK" }),
      expect.objectContaining({ ruleId: "SPHERICAL_GEOMETRY_WITHOUT_ENGAGEMENT_CLAIM" }),
    ]));
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain("Greater engagement");
    expect(result.canonicalizedArtifact?.contentHtml).toContain("Buyer evaluation framework");
  });

  test("replaces a semantic spherical-versus-flat comparison without narrow product headers", () => {
    const html = "<table><tr><th>Feature</th><th>Spherical Display</th><th>Traditional Flat Display</th></tr><tr><td>Visibility</td><td>Omnidirectional, visible from all sides</td><td>Front-facing</td></tr><tr><td>Content Creation</td><td>Custom, panoramic or curved</td><td>Standard video</td></tr></table>";
    const before = evaluateGlwReferenceClaimAuthority({ artifact: artifact(html), authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
    const result = canonicalize(html, before.findings);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toHaveLength(1);
    expect(result.receipt.transformations[0]).toMatchObject({ ruleId: "UNSUPPORTED_STRUCTURED_COMPARISON_TO_BUYER_EVALUATION_FRAMEWORK" });
    expect(result.canonicalizedArtifact?.contentHtml).toContain("Buyer evaluation framework");
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain("Traditional Flat Display");
  });

  test("converts unsupported durability meaning to an environmental verification question", () => {
    const text = "A weatherproofing strategy provides long-term durability.";
    const result = canonicalize(`<p>${text}</p>`, [finding("DURABILITY", text)]);

    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({ ruleId: "DURABILITY_ASSERTION_TO_ENVIRONMENTAL_REQUIREMENT_QUESTION" }));
    expect(result.canonicalizedArtifact?.contentHtml).toContain("Which environmental protection and durability requirements");
    const qa = evaluateGlwReferenceClaimAuthority({ artifact: result.canonicalizedArtifact!, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
    expect(qa.ok).toBe(true);
  });

  test.each([
    ["The spherical format may suit settings where visual curiosity, crowd movement, and 360-degree presence are important.", "SPHERICAL_GEOMETRY_WITHOUT_ENGAGEMENT_CLAIM"],
    ["As visual technologies expand, new approaches may emerge for 360-degree, immersive outdoor displays.", "SPHERICAL_GEOMETRY_WITHOUT_ENGAGEMENT_CLAIM"],
    ["Spherical displays can deliver 360-degree impact and provide content accessibility for audiences in open spaces.", "SPHERICAL_GEOMETRY_WITHOUT_ENGAGEMENT_CLAIM"],
  ] as const)("reduces unsupported spherical presentation wording: %s", (text, ruleId) => {
    const result = canonicalize(`<p>${text}</p>`, [finding("PRODUCT_SPECIFICATION", text)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({ ruleId }));
    expect(result.canonicalizedArtifact?.contentHtml).toContain("confirm project-specific viewing directions");
  });

  test("converts unsupported ingress guidance to a supplier verification question", () => {
    const text = "Ingress Protection: Plan for appropriate resistance to moisture and particles.";
    const result = canonicalize(`<li>${text}</li>`, [finding("INGRESS_PROTECTION", text)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({ ruleId: "INGRESS_ASSERTION_TO_SUPPLIER_QUESTION" }));
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain("appropriate resistance");
  });

  test.each([
    "A public art activation or interactive experience at civic spaces or mixed-use developments.",
    "Conceptualize use cases that include interactive installations and real-time data visualizations.",
  ])("converts unlabeled interactive concepts without preserving capability examples: %s", (text) => {
    const result = canonicalize(`<li>${text}</li>`, [finding("INTERACTIVITY", text)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({ ruleId: "UNLABELED_INTERACTIVITY_TO_EXPLICIT_CONCEPT" }));
    expect(result.canonicalizedArtifact?.contentHtml).toContain("subject to confirmation");
  });

  test.each([
    "Visitors can influence the displayed content through connected input systems.",
    "Users could control visual changes through an external interface.",
    "Interactive experiences can allow participants to influence displayed content.",
    "Creating an experience where attendees trigger changes through connected inputs.",
  ])("converts unsupported interactivity assertions to conditional supplier verification: %s", (text) => {
    const result = canonicalize(`<li>${text}</li>`, [finding("INTERACTIVITY", text)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({
      ruleId: "INTERACTIVITY_ASSERTION_TO_CONDITIONAL_VERIFICATION",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
    }));
    expect(result.canonicalizedArtifact?.contentHtml).toContain("If an interactive experience is being considered");
    expect(result.canonicalizedArtifact?.contentHtml).toContain("confirm with the selected supplier whether the selected system supports the proposed interaction");
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain(text);
    const qa = evaluateGlwReferenceClaimAuthority({ artifact: result.canonicalizedArtifact!, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
    expect(qa.findings.filter((entry) => entry.authorityStatus === "UNSUPPORTED")).toEqual([]);
  });

  test("does not weaken an interactivity assertion backed by authority", () => {
    const text = "Visitors can control the experience through an approved interface.";
    const result = canonicalize(`<p>${text}</p>`, [supportedFinding("INTERACTIVITY", text)]);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toBe(`<p>${text}</p>`);
    expect(result.receipt.transformations).toEqual([]);
  });

  test("keeps ambiguous interactivity language fail-closed", () => {
    const text = "Interactive possibilities may be relevant to the concept.";
    const result = canonicalize(`<p>${text}</p>`, [finding("INTERACTIVITY", text)]);
    expect(result.ok).toBe(false);
    expect(result.canonicalizedArtifact).toBeNull();
    expect(result.receipt.transformations[0]).toMatchObject({ ruleId: "AMBIGUOUS_PROTECTED_ASSERTION", disposition: "BLOCK", safeToTransform: false });
  });

  test("contains no target, product, page, or blocked-sentence hardcoding", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/zero-authority-claim-canonicalization.ts"), "utf8");
    const rule = source.slice(source.indexOf("const interactionActor"), source.indexOf("return { claimClasses, originalText: text, canonicalText: null", source.indexOf("const interactionActor")));
    expect(rule).not.toMatch(/Colorado|Outdoor Digital Sphere|5944dc3a|683323|Hosting interactive experiences where visitors influence/);
  });

  test("converts unsupported maintenance-performance guidance to a supplier question", () => {
    const text = "Cleaning Protocols: Establish cleaning protocols to prevent dust, pollen, or weather residue from diminishing image quality.";
    const result = canonicalize(`<li>${text}</li>`, [finding("SERVICE_CAPABILITY", text)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({ ruleId: "SERVICE_MAINTENANCE_ASSERTION_TO_SUPPLIER_QUESTION" }));
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain("diminishing image quality");
  });

  test.each([
    "Timeline Mapping: Create a project schedule outlining deadlines for approvals, delivery, setup, content programming, and possible rehearsals.",
    "Schedule Planning: Develop a project schedule with milestones for approvals, delivery, setup, content programming, and rehearsals.",
  ])("reduces labeled project-schedule guidance to supplier verification: %s", (text) => {
    const result = canonicalize(`<p>${text}</p>`, [finding("PRODUCT_CAPABILITY", text)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({
      ruleId: "PROJECT_SCHEDULE_GUIDANCE_TO_SUPPLIER_QUESTION",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
    }));
    expect(result.canonicalizedArtifact?.contentHtml).toContain("What project schedule and milestones should the project team confirm with the selected supplier for approvals, delivery, setup, content preparation, and any required rehearsals?");
    const qa = evaluateGlwReferenceClaimAuthority({ artifact: result.canonicalizedArtifact!, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
    expect(qa.ok).toBe(true);
  });

  test("matches project-schedule guidance independently of state context", () => {
    const text = "Timeline Mapping: Prepare a project schedule outlining milestones for approvals, delivery, setup, content programming, and rehearsals.";
    const html = `<h1>Outdoor Digital Sphere in Wyoming</h1><p>${text}</p>`;
    const result = canonicalize(html, [finding("PRODUCT_CAPABILITY", text)]);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toContain("Outdoor Digital Sphere in Wyoming");
    expect(result.receipt.transformations[0]?.ruleId).toBe("PROJECT_SCHEDULE_GUIDANCE_TO_SUPPLIER_QUESTION");
  });

  test.each([
    "Outdoor Digital Sphere content programming keeps event schedules synchronized.",
    "System content programming keeps event schedules synchronized.",
    "Create content programming for the event schedule.",
  ])("keeps non-planning capability assertions fail-closed: %s", (text) => {
    const result = canonicalize(`<p>${text}</p>`, [finding("PRODUCT_CAPABILITY", text)]);
    expect(result.ok).toBe(false);
    expect(result.canonicalizedArtifact).toBeNull();
    expect(result.receipt.transformations[0]).toMatchObject({ ruleId: "AMBIGUOUS_PROTECTED_ASSERTION", disposition: "BLOCK", safeToTransform: false });
  });

  test("canonicalizes labeled content-programming buyer question to neutral evaluation question", () => {
    const text = "Content Programming: Which type of content—abstract, branded, informational, or artistic—suits the intended audience and environment?";
    const result = canonicalize(`<p>${text}</p>`, [finding("PRODUCT_CAPABILITY", text)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.blockedClaims).toEqual([]);
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({
      ruleId: "CONTENT_PLANNING_BUYER_QUESTION_TO_NEUTRAL_EVALUATION",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      canonicalText: "Content planning: What content approach should the project team review for the proposed display?",
    }));
    expect(result.canonicalizedArtifact?.contentHtml).toContain("Content planning: What content approach should the project team review for the proposed display?");
    const qa = evaluateGlwReferenceClaimAuthority({ artifact: result.canonicalizedArtifact!, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
    expect(qa.ok).toBe(true);
  });

  test("canonicalizes exact HI spherical content-planning assertion to the bounded buyer question", () => {
    const text = "The unique shape of a digital sphere means visuals should be designed to leverage the 360-degree display area, possibly requiring custom animated loops or coordinated color sequences.";
    const result = canonicalize(`<p>${text}</p>`, [finding("PRODUCT_SPECIFICATION", text)]);

    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({
      originalText: text,
      ruleId: "SPHERICAL_CONTENT_PLANNING_ASSERTION_TO_BUYER_QUESTION",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      canonicalText: "Content planning: What content approach should the project team review for the spherical display, including project-specific viewing directions and any custom content requirements?",
    }));
    expect(result.receipt.blockedClaims).toEqual([]);
  });

  test("canonicalizes exact HI documentation directive to the bounded buyer question", () => {
    const text = "Clarify what documentation\u2014technical specifications, installation plans, code compliance\u2014will be supplied.";
    const result = canonicalize(`<p>${text}</p>`, [finding("PRODUCT_SPECIFICATION", text)]);

    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({
      originalText: text,
      ruleId: "PROJECT_DOCUMENTATION_DIRECTIVE_TO_BUYER_QUESTION",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      canonicalText: "What technical specifications, installation documentation, and code-compliance information should the project team request from the selected supplier and qualified professionals for the proposed installation?",
    }));
    expect(result.receipt.blockedClaims).toEqual([]);
  });

  test("clears blocked claims for fixture containing both HI blocked claims plus already-supported transformations", () => {
    const claim1 = "The unique shape of a digital sphere means visuals should be designed to leverage the 360-degree display area, possibly requiring custom animated loops or coordinated color sequences.";
    const claim2 = "Clarify what documentation\u2014technical specifications, installation plans, code compliance\u2014will be supplied.";
    const climate = "Project planners should consider these region-specific factors as part of their assessment and planning: Environmental Exposure: Can the selected supplier confirm how the system is designed to address exposure to salt air, variable humidity, and sudden weather changes common in Hawaii coastal areas?";
    const warranty = "Discuss warranty and support resources with the supplier as part of purchase planning.";

    const html = `<p>${claim1}</p><p>${claim2}</p><p>${climate}</p><p>${warranty}</p>`;
    const result = canonicalize(html, [
      finding("PRODUCT_SPECIFICATION", claim1),
      finding("PRODUCT_SPECIFICATION", claim2),
      finding("CLIMATE", climate),
      finding("WARRANTY", warranty),
    ]);

    expect(result.ok).toBe(true);
    expect(result.receipt.blockedClaims).toEqual([]);
    expect(result.receipt.modelInvoked).toBe(false);
    expect(result.receipt.consumesN8nExecution).toBe(false);
    expect(result.canonicalizedArtifact?.contentHtml).toContain("Content planning: What content approach should the project team review for the spherical display, including project-specific viewing directions and any custom content requirements?");
    expect(result.canonicalizedArtifact?.contentHtml).toContain("What technical specifications, installation documentation, and code-compliance information should the project team request from the selected supplier and qualified professionals for the proposed installation?");
  });

  test("keeps unrelated ambiguous PRODUCT_SPECIFICATION assertion fail-closed", () => {
    const text = "The display guarantees superior outcomes in all environments.";
    const result = canonicalize(`<p>${text}</p>`, [finding("PRODUCT_SPECIFICATION", text)]);
    expect(result.ok).toBe(false);
    expect(result.canonicalizedArtifact).toBeNull();
    expect(result.receipt.transformations[0]).toMatchObject({ ruleId: "AMBIGUOUS_PROTECTED_ASSERTION", safeToTransform: false });
  });

  test("preserves GA content-planning buyer-question canonicalization rule output", () => {
    const text = "Content Programming: Which type of content\u2014abstract, branded, informational, or artistic\u2014suits the intended audience and environment?";
    const result = canonicalize(`<p>${text}</p>`, [finding("PRODUCT_CAPABILITY", text)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({
      ruleId: "CONTENT_PLANNING_BUYER_QUESTION_TO_NEUTRAL_EVALUATION",
      canonicalText: "Content planning: What content approach should the project team review for the proposed display?",
    }));
  });

  test("preserves existing spherical-geometry normalization rule", () => {
    const text = "Spherical displays can deliver 360-degree impact and provide content accessibility for audiences in open spaces.";
    const result = canonicalize(`<p>${text}</p>`, [finding("PRODUCT_SPECIFICATION", text)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({
      ruleId: "SPHERICAL_GEOMETRY_WITHOUT_ENGAGEMENT_CLAIM",
      canonicalText: "Spherical display geometry; confirm project-specific viewing directions and content requirements.",
    }));
  });

  test("preserves climate/warranty/pricing/installation/service canonicalization rules", () => {
    const cases = [
      ["CLIMATE", "Indiana climate conditions affect operation.", "CLIMATE_ASSERTION_TO_BUYER_QUESTION"],
      ["WARRANTY", "The product includes a five-year warranty.", "WARRANTY_ASSERTION_TO_BUYER_QUESTION"],
      ["PRICING", "The product has a lower operating cost.", "PRICING_ASSERTION_TO_BUYER_QUESTION"],
      ["INSTALLATION_CAPABILITY", "Clarify who verifies dimensions, selects the projector, approves the location, designs support, supplies power and signal, coordinates access, installs the enclosure, commissions the system, and maintains it after turnover.", "INSTALLATION_ASSERTION_TO_RESPONSIBILITY_QUESTION"],
      ["SERVICE_CAPABILITY", "Cleaning Protocols: Establish cleaning protocols to prevent dust, pollen, or weather residue from diminishing image quality.", "SERVICE_MAINTENANCE_ASSERTION_TO_SUPPLIER_QUESTION"],
    ] as const;

    for (const [claimClass, text, ruleId] of cases) {
      const result = canonicalize(`<p>${text}</p>`, [finding(claimClass, text)]);
      expect(result.ok).toBe(true);
      expect(result.receipt.transformations).toContainEqual(expect.objectContaining({ ruleId, safeToTransform: true }));
    }
  });

  test("preserves existing climate and generic supplier-verification transformations", () => {
    const climate = "California climate conditions affect operation.";
    const capability = "The system supports interactive content.";
    const result = canonicalize(`<p>${climate}</p><p>${capability}</p>`, [finding("CLIMATE", climate), finding("PRODUCT_CAPABILITY", capability)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toEqual(expect.arrayContaining([
      expect.objectContaining({ originalText: climate, ruleId: "CLIMATE_ASSERTION_TO_BUYER_QUESTION" }),
      expect.objectContaining({ originalText: capability, ruleId: "GENERIC_CAPABILITY_TO_SUPPLIER_QUESTION" }),
    ]));
  });

  test.each(["Alaska", "Alabama", "Arkansas"])("leaves previously passing %s planning text unchanged", (state) => {
    const html = `<h1>Outdoor Digital Sphere in ${state}</h1><p>Plan the proposed project around the intended audience, location, content, and schedule.</p>`;
    const result = canonicalize(html, []);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toBe(html);
    expect(result.receipt.transformations).toEqual([]);
  });

  test.each([
    ["Working with varied environments requires review:", "Climate and Seasonal Exposure:", "What climate conditions may affect placement?", "Keep this neighboring guidance."],
    ["Conceptual planning should address:", "Weather-Resistant Materials:", "Consider materials that can withstand rain and wind.", "Preserve this separate item."],
  ])("applies a safe transformation across an introductory paragraph and labeled list item", (intro, label, claim, neighbor) => {
    const text = `${intro} ${label} ${claim}`;
    const result = canonicalize(`<p>${intro}</p><ul><li><strong>${label}</strong> ${claim}</li><li>${neighbor}</li></ul>`, [finding("CLIMATE", text)]);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toContain("What environmental conditions should the project team ask");
    expect(result.canonicalizedArtifact?.contentHtml).toContain(neighbor);
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain(claim);
  });

  test("canonicalizes nested protected spans before their enclosing cross-element span", () => {
    const introduction = "Review these conditions with qualified professionals:";
    const category = "Environmental Conditions: Hot weather and airborne dust require evaluation.";
    const nested = "What material protections are required to withstand wind conditions?";
    const result = canonicalize(`<p>${introduction}</p><ul><li>${category}<ul><li>${nested}</li><li>Preserve this separate question.</li></ul></li></ul>`, [
      finding("CLIMATE", `${introduction} ${category}`),
      finding("CLIMATE", nested),
    ]);
    expect(result.ok).toBe(true);
    expect(result.receipt.blockedClaims).toEqual([]);
    expect(result.canonicalizedArtifact?.contentHtml).toContain("Preserve this separate question.");
  });

  test("maps a classified sentence from parent text into its first nested list item", () => {
    const text = "Ask: What material protections are required to withstand wind conditions?";
    const result = canonicalize("<ul><li><strong>Environmental Conditions:</strong> Review site exposure. Ask:<ul><li>What material protections are required to withstand wind conditions?</li><li>Preserve this separate question.</li></ul></li></ul>", [finding("CLIMATE", text)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.blockedClaims).toEqual([]);
    expect(result.canonicalizedArtifact?.contentHtml).toContain("What environmental conditions should the project team ask");
    expect(result.canonicalizedArtifact?.contentHtml).toContain("Preserve this separate question.");
  });

  test("removes nonessential unsupported market and cost content", () => {
    const pricing = "Engage Early: Begin supplier conversations as early as possible to clarify feasibility, timelines, and costs.";
    const heading = "Future Evaluation: Trends and Concepts in Digital Sphere Use";
    const result = canonicalize(`<h2>Best Practices</h2><ol><li>${pricing}</li></ol><h2>${heading}</h2><p>Market discussion that is not needed.</p><h2>Request Guidance</h2><p>Contact us to discuss the project.</p>`, [finding("PRICING", pricing), finding("MARKET_ADOPTION", heading)]);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain(pricing);
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain(heading);
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain("Market discussion that is not needed.");
    expect(result.canonicalizedArtifact?.contentHtml).toContain("Request Guidance");
  });

  test("converts repeated existing-content defects without product or target-specific rules", () => {
    const cases = [
      ["PRODUCT_SPECIFICATION", "Explore our Accent Rear Projection Film solutions for additional product specifications, turnkey package details, and display options.", "GENERIC_SPECIFICATION_CTA_TO_SUPPLIER_QUESTION"],
      ["PRODUCT_SPECIFICATION", "Plan for adjustable sphere brightness and anti-glare surface treatment.", "PRODUCT_SPECIFICATION_ASSERTION_TO_SUPPLIER_QUESTION"],
      ["CLIMATE", "Record nearby heat sources, water sources, airborne contaminants, direct sun, cleaning activity, and other conditions that the project team considers relevant.", "CLIMATE_ASSERTION_TO_BUYER_QUESTION"],
      ["TRAINING", "Training and handoff scope should be agreed by the project team.", "TRAINING_ASSERTION_TO_SUPPLIER_QUESTION"],
      ["INSTALLATION_CAPABILITY", "Clarify who verifies dimensions, selects the projector, approves the location, designs support, supplies power and signal, coordinates access, installs the enclosure, commissions the system, and maintains it after turnover.", "INSTALLATION_ASSERTION_TO_RESPONSIBILITY_QUESTION"],
    ] as const;

    for (const [claimClass, text, ruleId] of cases) {
      const result = canonicalize(`<p>${text}</p>`, [finding(claimClass, text)]);
      expect(result.ok).toBe(true);
      expect(result.receipt.transformations).toContainEqual(expect.objectContaining({ ruleId, safeToTransform: true }));
      expect(result.canonicalizedArtifact?.contentHtml).not.toContain(text);
      const qa = evaluateGlwReferenceClaimAuthority({ artifact: result.canonicalizedArtifact!, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
      expect(qa.ok).toBe(true);
    }
  });

  test("canonicalizes a classified sentence spanning nested inline markup", () => {
    const text = "Climate Control: Spheres require stable temperature and humidity for reliable operation.";
    const result = canonicalize(`<ul><li><strong>Climate Control:</strong> Spheres require stable temperature and humidity for reliable operation. Preserve the remaining project guidance.</li></ul>`, [finding("CLIMATE", text)]);

    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain("Spheres require stable temperature");
    expect(result.canonicalizedArtifact?.contentHtml).toContain("Preserve the remaining project guidance.");
  });

  test("rehabilitates an existing artifact through classification, canonicalization, and unchanged post-check", () => {
    const input = artifact("<p>Explore our display solutions for additional product specifications, turnkey package details, and display options.</p>");
    const result = rehabilitateGlwExistingArtifact({ artifact: input });

    expect(result.ok).toBe(true);
    expect(result.before.ok).toBe(false);
    expect(result.after?.ok).toBe(true);
    expect(result.canonicalization.canonicalizedArtifact).not.toBe(input);
    expect(input.contentHtml).toContain("additional product specifications");
  });

  test("prefers removal for observed nonessential climate and cost claims", () => {
    const climate = "Alaska’s climate, vast geography, and distinctive event calendar add unique planning challenges and opportunities.";
    const comfort = "Audience Comfort: In winter months, consider potential wind, temperature, and crowd movement when designing event flow and display interaction zones.";
    const pricing = "Engage Early: Begin supplier conversations as early as possible to clarify feasibility, timelines, and costs.";
    const result = canonicalize(`<p>${climate} Key considerations follow.</p><ul><li>${comfort}</li><li>${pricing}</li></ul><p>Contact us to discuss the project.</p>`, [finding("CLIMATE", climate), finding("CLIMATE", comfort), finding("PRICING", pricing)]);
    expect(result.ok).toBe(true);
    expect(result.receipt.transformations).toEqual(expect.arrayContaining([
      expect.objectContaining({ originalText: climate, disposition: "REMOVE", safeToTransform: true }),
      expect.objectContaining({ originalText: comfort, disposition: "REMOVE", safeToTransform: true }),
      expect.objectContaining({ originalText: pricing, disposition: "REMOVE", safeToTransform: true }),
    ]));
  });

  test("reduces excessive supplier-question repetition without adding factual meaning", () => {
    const repeated = Array.from({ length: 5 }, (_, index) => `<li>Does the selected supplier confirm project requirement ${index + 1}?</li>`).join("");
    const target = "Does the supplier confirm that content can be customized and managed to suit these environmental factors?";
    const result = canonicalize(`<ul>${repeated}<li>${target}</li></ul>`, []);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toContain("What content-management requirements should the project team document");
    expect(result.receipt.transformations).toContainEqual(expect.objectContaining({ ruleId: "REDUCE_SUPPLIER_QUESTION_REPETITION" }));
  });

  test("leaves already safe conceptual text, mapped facts, and navigation identity unchanged", () => {
    const html = '<h2>Potential Applications</h2><p>One possible concept could be considered for an event.</p><p>Mapped fact.</p><a href="/outdoor-digital-sphere/">Outdoor Digital Sphere</a>';
    const result = canonicalize(html, []);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toBe(html);
    expect(result.receipt.transformations).toEqual([]);
  });

  test("leaves an explicitly supported mapped finding unchanged", () => {
    const html = "<p>The product has a documented five-year warranty.</p>";
    const supported = { ...finding("WARRANTY", "The product has a documented five-year warranty."), authoritySource: "approved-sheet", authorityStatus: "SUPPORTED" as const, authorityKind: "REFERENCE_SUPPORTED" as const };
    const result = canonicalize(html, [supported]);
    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toBe(html);
    expect(result.receipt.transformations).toEqual([]);
  });

  test("blocks ambiguous text and does not emit a transformed artifact", () => {
    const text = "A complex operating environment creates special requirements.";
    const result = canonicalize(`<p>${text}</p>`, [finding("PERFORMANCE", text)]);
    expect(result.ok).toBe(false);
    expect(result.canonicalizedArtifact).toBeNull();
    expect(result.receipt.transformations[0]).toMatchObject({ disposition: "BLOCK", safeToTransform: false });
  });

  test("blocks a labeled rewrite candidate that would retain unsupported capability meaning", () => {
    const text = "Operations: The system provides remote management.";
    const result = canonicalize(`<p>${text}</p>`, [finding("REMOTE_MANAGEMENT", text)]);
    expect(result.ok).toBe(false);
    expect(result.receipt.blockedClaims).toEqual([text]);
  });

  test("keeps specific V2_5 transforms as first priority even in Outdoor Sphere fallback mode", () => {
    const text = "The system supports interactive content.";
    const result = canonicalize(`<p>${text}</p>`, [finding("PRODUCT_CAPABILITY", text)], {
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    });

    expect(result.ok).toBe(true);
    expect(result.receipt.transformations[0]).toMatchObject({
      ruleId: "GENERIC_CAPABILITY_TO_SUPPLIER_QUESTION",
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    });
  });

  test("STRICT mode blocks unmatched protected capability assertions", () => {
    const text = "Capability posture should be assumed project-wide.";
    const result = canonicalize(`<p>${text}</p>`, [finding("PRODUCT_CAPABILITY", text)], {
      fallbackPolicy: "STRICT",
    });
    expect(result.ok).toBe(false);
    expect(result.receipt.transformations[0]).toMatchObject({
      ruleId: "AMBIGUOUS_PROTECTED_ASSERTION",
      fallbackPolicy: "STRICT",
    });
  });

  test("Outdoor Sphere fallback converts unmatched capability/specification and removes unsupported local/market facts", () => {
    const capability = "Capability posture should be assumed project-wide.";
    const specification = "Specification baseline applies automatically in this market.";
    const localFact = "Iowa is home to statewide digital sphere standards.";
    const market = "Regional adoption and market movement prove universal readiness.";
    const result = canonicalize(
      `<p>${capability}</p><p>${specification}</p><p>${localFact}</p><p>${market}</p>`,
      [
        finding("PRODUCT_CAPABILITY", capability),
        finding("PRODUCT_SPECIFICATION", specification),
        finding("LOCATION_FACT", localFact),
        finding("MARKET_ADOPTION", market),
      ],
      { fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE" },
    );

    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toContain("What capabilities should the project team confirm with the selected supplier for the proposed configuration?");
    expect(result.canonicalizedArtifact?.contentHtml).toContain("Which technical and performance specifications should the selected supplier confirm in writing for the proposed configuration?");
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain(localFact);
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain(market);
  });

  test("Outdoor Sphere fallback replacement strips unsupported detail and passes post-transform authority recheck", () => {
    const text = "Capability posture should be assumed project-wide with guaranteed impact and local performance outcomes.";
    const result = canonicalize(`<p>${text}</p>`, [finding("PRODUCT_CAPABILITY", text)], {
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    });

    expect(result.ok).toBe(true);
    expect(result.canonicalizedArtifact?.contentHtml).toContain("What capabilities should the project team confirm with the selected supplier for the proposed configuration?");
    expect(result.canonicalizedArtifact?.contentHtml).not.toContain("guaranteed impact");
    expect(result.receipt.blockedClaims).toEqual([]);

    const qa = evaluateGlwReferenceClaimAuthority({ artifact: result.canonicalizedArtifact!, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
    expect(qa.findings.filter((entry) => entry.authorityStatus === "UNSUPPORTED")).toEqual([]);
  });

  test("Outdoor Sphere fixed-point canonicalization re-evaluates residual unsupported claims across passes", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/zero-authority-claim-canonicalization.ts"), "utf8");
    expect(source).toContain("for (let pass = 1; pass <= maxPasses; pass += 1)");
    expect(source).toContain("currentFindings = authority ? post.findings : currentFindings;");
    expect(source).toContain("const unsupportedAfter = authority");
    expect(source).toContain("unsupportedAfter.length === 0");
    expect(source).toContain("...(passes.length > 0 ? { passes } : {})");
  });

  test("terminal conceptual canonicalization avoids recursive wrapping for KY residual shape and is idempotent", () => {
    const residual = "Organizations may evaluate spherical displays as a potential way to create: One possible concept a project team could consider is one possible concept a project team could consider is an interactive experience, subject to confirmation of the selected system and project requirements.";
    const rawArtifact = artifact(`<p>${residual}</p>`);
    const authority = { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] };

    const first = canonicalizeGlwZeroAuthorityClaims({
      rawArtifact,
      authoritativeFactReferenceIds: [],
      findings: [finding("PRODUCT_SPECIFICATION", residual)],
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
      authority,
    });

    expect(first.ok).toBe(true);
    expect(first.receipt.blockedClaims).toEqual([]);
    expect(first.receipt.modelInvoked).toBe(false);
    expect(first.receipt.consumesN8nExecution).toBe(false);
    expect(first.receipt.transformations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleId: "TERMINAL_CONCEPTUAL_APPLICATION_TO_BUYER_QUESTION",
        disposition: "CONVERT_TO_BUYER_QUESTION",
        safeToTransform: true,
      }),
    ]));
    expect(first.canonicalizedArtifact?.contentHtml).toContain("What visual or experience concept should the project team evaluate for the proposed installation?");
    expect(first.canonicalizedArtifact?.contentHtml).not.toContain("one possible concept a project team could consider is one possible concept");

    const afterFirst = evaluateGlwReferenceClaimAuthority({ artifact: first.canonicalizedArtifact!, authority });
    expect(afterFirst.findings.filter((entry) => entry.authorityStatus === "UNSUPPORTED")).toEqual([]);

    const second = canonicalizeGlwZeroAuthorityClaims({
      rawArtifact: first.canonicalizedArtifact!,
      authoritativeFactReferenceIds: [],
      findings: afterFirst.findings,
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
      authority,
    });

    expect(second.ok).toBe(true);
    expect(second.receipt.blockedClaims).toEqual([]);
    expect(second.canonicalizedArtifact?.contentHtml).toBe(first.canonicalizedArtifact?.contentHtml);

    const source = readFileSync(join(process.cwd(), "src/modules/glw/zero-authority-claim-canonicalization.ts"), "utf8");
    expect(source).toContain("const maxPasses = fallbackPolicy === \"OUTDOOR_SPHERE_STATE_SERVICE\" && authority ? 3 : 1;");
    expect(source).toContain("TERMINAL_CONCEPTUAL_APPLICATION_TO_BUYER_QUESTION");
  });

  test("source contract enforces no-progress fail-closed and bounded max-pass exhaustion for Outdoor Sphere fixed-point mode", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/zero-authority-claim-canonicalization.ts"), "utf8");
    expect(source).toContain("const maxPasses = fallbackPolicy === \"OUTDOOR_SPHERE_STATE_SERVICE\" && authority ? 3 : 1;");
    expect(source).toContain("if (outputHash === inputHash || seenOutputHashes.has(outputHash)) {");
    expect(source).toContain("if (pass === maxPasses) {");
    expect(source).toContain("unsupportedAfter.length === 0");
    expect(source).toContain("passes.push({");
  });

  test("strict mode remains single-pass fail-closed and non-Outdoors scope remains strict", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/zero-authority-claim-canonicalization.ts"), "utf8");
    const generationRoute = readFileSync(join(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");

    expect(source).toContain("fallbackPolicy?: GlwZeroAuthorityFallbackPolicy;");
    expect(source).toContain("const maxPasses = fallbackPolicy === \"OUTDOOR_SPHERE_STATE_SERVICE\" && authority ? 3 : 1;");
    expect(generationRoute).toContain("return \"OUTDOOR_SPHERE_STATE_SERVICE\";");
    expect(generationRoute).toContain("return \"STRICT\";");
  });

  test("does not conceal cross-state contamination", () => {
    const html = "<h1>Outdoor Digital Sphere in Indiana</h1><p>Our Illinois installations serve local venues.</p>";
    const result = canonicalize(html, []);
    expect(result.canonicalizedArtifact?.contentHtml).toBe(html);
    expect(evaluateGlwStateLocalizationContamination({ contentHtml: result.canonicalizedArtifact!.contentHtml, expectedStateCode: "IN" }).ok).toBe(false);
  });

  test("keeps the raw artifact immutable and emits stable lineage", () => {
    const text = "The system supports interactive content.";
    const raw = artifact(`<p>${text}</p>`);
    const before = structuredClone(raw);
    const first = canonicalizeGlwZeroAuthorityClaims({ rawArtifact: raw, authoritativeFactReferenceIds: [], findings: [finding("PRODUCT_CAPABILITY", text)] });
    const second = canonicalizeGlwZeroAuthorityClaims({ rawArtifact: raw, authoritativeFactReferenceIds: [], findings: [finding("PRODUCT_CAPABILITY", text)] });
    expect(raw).toEqual(before);
    expect(first.rawArtifact).toEqual(before);
    expect(first.receipt).toMatchObject({
      policyVersion: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION,
      policyFingerprint: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_FINGERPRINT,
      rawArtifactSha256: createHash("sha256").update(before.contentHtml).digest("hex"),
      consumesN8nExecution: false,
      modelInvoked: false,
    });
    expect(first.receipt.canonicalizedArtifactSha256).toBe(second.receipt.canonicalizedArtifactSha256);
    expect(first.receipt.receiptId).toBe(second.receipt.receiptId);
  });

  test("runs before hardened QA and WordPress mutation while preserving separate lineage fields", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    const canonicalization = route.indexOf("canonicalizeGlwZeroAuthorityClaims({");
    const rawLineage = route.indexOf("rawGeneratedDraft,", canonicalization);
    const productQa = route.indexOf("productAuthorityFailures");
    const claimQa = route.indexOf("claimAuthority && !claimAuthority.ok");
    const localizationQa = route.indexOf("localizationFailures");
    const wordpressWrite = route.indexOf("writeGenesisWordPressDraft({ operation:");
    expect(canonicalization).toBeGreaterThan(0);
    expect(rawLineage).toBeGreaterThan(canonicalization);
    expect(rawLineage).toBeLessThan(productQa);
    expect(productQa).toBeLessThan(claimQa);
    expect(claimQa).toBeLessThan(localizationQa);
    expect(localizationQa).toBeLessThan(wordpressWrite);
    expect(route).toContain("canonicalizedGeneratedDraft: canonicalization.canonicalizedArtifact");
    expect(route).toContain("canonicalizationReceipt: canonicalization.receipt");
  });
});

const forensicRoot = process.env.GLW_FORENSIC_PERSISTENCE_DIR;
(forensicRoot ? test : test.skip)("preserves execution 644114 evidence and blocks the former candidate under repaired semantic QA", () => {
  const repositoryPath = join(forensicRoot!, "glw-page-execution-repository.json");
  const envelope = JSON.parse(readFileSync(repositoryPath, "utf8")) as { data: { records: Array<{ jobId: string; generatedDraft: ReturnType<typeof artifact>; rawGeneratedDraft?: ReturnType<typeof artifact>; qaChecks: { claimAuthority: { findings: GlwClaimAuthorityFinding[] } } }> } };
  const job = envelope.data.records.find((record) => record.jobId === "dbb8574d-c8d5-43c0-aba1-4d445589b4f2");
  expect(job).toBeDefined();
  const rawArtifact = job!.rawGeneratedDraft ?? job!.generatedDraft;
  const rawSha = createHash("sha256").update(rawArtifact.contentHtml).digest("hex");
  const rawClaims = evaluateGlwReferenceClaimAuthority({ artifact: rawArtifact, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  const result = canonicalizeGlwZeroAuthorityClaims({ rawArtifact, authoritativeFactReferenceIds: [], findings: rawClaims.findings });
  expect(rawSha).toBe("6093ef4bae6f3a0ff1d7c601571f718cc361e6a479d879fe0049ad4b09ac7955");
  expect(createHash("sha256").update(rawArtifact.contentHtml).digest("hex")).toBe(rawSha);
  expect(createHash("sha256").update(job!.generatedDraft.contentHtml).digest("hex")).toBe("3bdb717488a0caa8773337c8b0e6d5fde25a0e2301dcef9e3c19b169b35cd06d");
  expect(result.ok).toBe(false);
  expect(result.canonicalizedArtifact).toBeNull();
  expect(result.receipt.blockedClaims.length).toBeGreaterThan(0);
});

(forensicRoot ? test : test.skip)("canonicalizes the exact Arkansas execution 665137 artifact without changing its lineage", () => {
  const repositoryPath = join(forensicRoot!, "glw-page-execution-repository.json");
  const envelope = JSON.parse(readFileSync(repositoryPath, "utf8")) as { data: { records: Array<{ jobId: string; externalExecutionId?: string | null; generatedDraft: ReturnType<typeof artifact>; rawGeneratedDraft?: ReturnType<typeof artifact> }> } };
  const job = envelope.data.records.find((record) => record.jobId === "3e7b6906-4091-40d7-8847-31224ba05715");
  expect(job?.externalExecutionId).toBe("665137");
  const rawArtifact = job!.rawGeneratedDraft ?? job!.generatedDraft;
  const rawSha = createHash("sha256").update(rawArtifact.contentHtml).digest("hex");
  const before = evaluateGlwReferenceClaimAuthority({ artifact: rawArtifact, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  const result = canonicalizeGlwZeroAuthorityClaims({ rawArtifact, authoritativeFactReferenceIds: [], findings: before.findings });
  const after = evaluateGlwReferenceClaimAuthority({ artifact: result.canonicalizedArtifact!, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });

  expect(rawSha).toBe("c24b2d264d8b104e67d9ea3c4e80fa42fcb531da0803cd4621cb08817b24b226");
  expect(result.ok).toBe(true);
  expect(result.canonicalizedArtifact).not.toBeNull();
  expect(result.receipt.transformations).toHaveLength(15);
  expect(result.receipt.blockedClaims).toEqual([]);
  expect(after.ok).toBe(true);
  expect(after.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED")).toEqual([]);
  expect(createHash("sha256").update(rawArtifact.contentHtml).digest("hex")).toBe(rawSha);
});

(forensicRoot ? test : test.skip)("canonicalizes the exact Arizona execution 666670 artifact without regeneration or persistence", () => {
  const repositoryPath = join(forensicRoot!, "glw-page-execution-repository.json");
  const envelope = JSON.parse(readFileSync(repositoryPath, "utf8")) as { data: { records: Array<{ jobId: string; externalExecutionId?: string | null; generatedDraft: ReturnType<typeof artifact>; rawGeneratedDraft?: ReturnType<typeof artifact> }> } };
  const job = envelope.data.records.find((record) => record.jobId === "f75fd8fb-07b6-407f-a4cf-fe7a52693502");
  expect(job?.externalExecutionId).toBe("666670");
  const rawArtifact = job!.rawGeneratedDraft ?? job!.generatedDraft;
  const rawSha = createHash("sha256").update(rawArtifact.contentHtml).digest("hex");
  const result = rehabilitateGlwExistingArtifact({ artifact: rawArtifact });

  expect(rawSha).toBe("9415c57c98bb2b61bff53c7b76f447e7edffd8a4a977a24189e715af11c5fb4c");
  expect(result.before.findings.some((finding) => finding.claimClass === "INTERACTIVITY" && finding.claimText.includes("HOA rules"))).toBe(false);
  expect(result.before.findings.some((finding) => finding.claimText === "Custom, panoramic or curved")).toBe(false);
  expect(result.before.findings.filter((finding) => finding.claimClass === "PRODUCT_SPECIFICATION" && finding.claimText.includes("Traditional Flat Display"))).toHaveLength(1);
  expect(result.ok).toBe(true);
  expect(result.canonicalization.canonicalizedArtifact).not.toBeNull();
  expect(result.canonicalization.receipt.transformations).toHaveLength(12);
  expect(result.canonicalization.receipt.blockedClaims).toEqual([]);
  expect(result.after?.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED")).toEqual([]);
  expect(createHash("sha256").update(rawArtifact.contentHtml).digest("hex")).toBe(rawSha);
});

(forensicRoot ? test.each([
  ["Alaska", "660615", "735d2f0aef9f4853b708265cd7d8a94b93c3ffc144dde4fb4d497defcba6d2cf", 8],
  ["Alabama", "663868", "911c9b955a911497e45523d0c9321ef55e94fcb30533b8600ba9ce17c82696ab", 10],
] as const) : test.skip)("preserves and canonicalizes the exact %s artifact", (_state, executionId, expectedSha, expectedTransformations) => {
  const repositoryPath = join(forensicRoot!, "glw-page-execution-repository.json");
  const envelope = JSON.parse(readFileSync(repositoryPath, "utf8")) as { data: { records: Array<{ externalExecutionId?: string | null; generatedDraft: ReturnType<typeof artifact>; rawGeneratedDraft?: ReturnType<typeof artifact> }> } };
  const job = envelope.data.records.find((record) => record.externalExecutionId === executionId);
  const rawArtifact = job!.rawGeneratedDraft ?? job!.generatedDraft;
  const rawSha = createHash("sha256").update(rawArtifact.contentHtml).digest("hex");
  const result = rehabilitateGlwExistingArtifact({ artifact: rawArtifact });

  expect(rawSha).toBe(expectedSha);
  expect(result.ok).toBe(true);
  expect(result.canonicalization.receipt.transformations).toHaveLength(expectedTransformations);
  expect(result.canonicalization.receipt.blockedClaims).toEqual([]);
  expect(result.after?.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED")).toEqual([]);
  expect(createHash("sha256").update(rawArtifact.contentHtml).digest("hex")).toBe(rawSha);
});
