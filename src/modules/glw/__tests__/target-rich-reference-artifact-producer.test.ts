jest.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveSharedRichPageProductionProfile } from "@/modules/foundation/shared-rich-page-production-authority";
import type { SitePageMediaAssignment, SitePageMediaRole } from "@/modules/foundation/site-page-media-assignment";
import { produceTargetRichReferenceArtifact } from "../target-rich-reference-artifact-producer";

const referenceArtifactHtml = `<style>.saw-page{width:100%}</style><main class="saw-page" data-genesis-primary-content data-composition-contract="GLW_RICH_REFERENCE_COMPOSITION_V1">
<section data-reference-section="HERO"><img data-media-role="PRODUCT_AUTHORITY" src="old-hero"><h1>Outdoor Digital Sphere in Indiana</h1><p>Create a memorable visual focal point for an Indiana venue, event, campus, or destination.</p><a href="/contact-us/">Request Project Information</a></section>
<section data-reference-section="PRODUCT_IDENTITY"><img data-media-role="CONTEXTUAL_IN_USE" src="old-support"><h2>A bold centerpiece for shared experiences</h2><p>For projects throughout Indiana, start with the setting, audience, content, and timing.</p><a href="/outdoor-digital-sphere/">Outdoor Digital Sphere</a></section>
<section data-reference-section="APPLICATIONS"><h2>Application ideas</h2><p>Explore concepts that connect the sphere to a clear audience and purpose.</p></section>
<section data-reference-section="PLANNING_GUIDANCE"><h2>Plan your project</h2><p>What location, audience, content goals, and schedule should the project team document?</p></section>
<section data-reference-section="CTA"><h2>Discuss an Outdoor Digital Sphere project in Indiana</h2><p>Contact us to request project information.</p></section>
</main>`;
const semanticArtifact = { title: "Outdoor Digital Sphere in Alaska", contentHtml: "<h1>Outdoor Digital Sphere in Alaska</h1><p>Plan the proposed project around the intended audience, location, content, and schedule.</p>", slug: "/outdoor-digital-sphere/alaska/", excerpt: "Plan an Outdoor Digital Sphere project in Alaska.", seoTitle: "Outdoor Digital Sphere in Alaska | Project Planning", metaDescription: "Plan an Outdoor Digital Sphere project in Alaska.", focusKeyphrase: "outdoor digital sphere Alaska" };

function assignment(role: SitePageMediaRole, id: string): SitePageMediaAssignment {
  return { assignmentId: `assignment-${role}`, organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", buildSessionId: "session", pageId: "page", pageRevisionId: "revision", slotId: role.toLowerCase(), role, asset: { type: "APPROVED_EXISTING", authorityReference: `product-media:${id}`, productId: "prod-outdoor-digital-sphere", wordpressMediaId: null, url: `data:image/jpeg;base64,${id}`, sha256: "a".repeat(64) }, metadata: { altText: "Outdoor Digital Sphere", caption: null, title: id, description: "Approved product media" }, approval: { candidateId: id, approvedBy: "owner", approvedAt: "2026-09-15T00:00:00.000Z" }, wordpressReceipt: null, createdAt: "2026-09-15T00:00:00.000Z" };
}

const profile = resolveSharedRichPageProductionProfile({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", productId: "prod-outdoor-digital-sphere", pageType: "LOCATION_SERVICE" })!;

describe("target rich-reference artifact producer", () => {
  test("accepts Alaska target data without target-specific code", () => {
    const result = produceTargetRichReferenceArtifact({ target: { targetId: "target-outdoor-ak", stateCode: "AK", stateName: "Alaska", canonicalPath: "/outdoor-digital-sphere/alaska/" }, product: { productId: "prod-outdoor-digital-sphere", productName: "Outdoor Digital Sphere", canonicalPath: "/outdoor-digital-sphere/" }, semanticArtifact, referenceArtifactHtml, mediaAssignments: [assignment("PRODUCT_AUTHORITY", "hero"), assignment("CONTEXTUAL_IN_USE", "support"), assignment("APPLICATION_EXPERIENCE", "support")], profile });
    expect(result.artifact).toMatchObject({ title: "Outdoor Digital Sphere in Alaska", slug: "/outdoor-digital-sphere/alaska/" });
    expect(result.artifact.contentHtml).toContain("Outdoor Digital Sphere in Alaska");
    expect(result.artifact.contentHtml).not.toContain("Indiana");
    expect(result.artifact.contentHtml).toContain('data-composition-role="hero"');
    expect(result.artifact.contentHtml).toContain('data-composition-role="visual-application"');
    expect(result.artifact.contentHtml).toContain('data-site-presentation-authority="LED_DISPLAY_WAREHOUSE_PRESENTATION_V1"');
    expect(result.artifact.contentHtml.match(/data:image\/jpeg;base64/g)).toHaveLength(2);
    expect(result.presentation).toMatchObject({ ok: true, checks: { darkHighContrastFoundation: true, blueElectricAccent: true, imageLedComposition: true, commercialDensity: true, excessiveEditorialWhitespace: false, thinBorderEditorialGridDominant: false, worksheetRuleGrammar: false, flatRedEditorialCtaDominant: false, commercialStainlessPresentationLeakage: false } });
    expect(result.qa).toMatchObject({ unsupportedFactualClaims: 0, geographicEvidenceEscapes: 0, comparisonAuthorityEscapes: 0, buyerQuestionPremiseEscapes: 0, unexpectedStateContamination: 0, internalGovernanceLanguage: 0, customerFacingCopyQuality: "PASS" });
  });

  test("accepts Indiana through the same producer and contains no state implementation literals", () => {
    const result = produceTargetRichReferenceArtifact({ target: { targetId: "target-outdoor-in", stateCode: "IN", stateName: "Indiana", canonicalPath: "/outdoor-digital-sphere/indiana/" }, product: { productId: "prod-outdoor-digital-sphere", productName: "Outdoor Digital Sphere", canonicalPath: "/outdoor-digital-sphere/" }, semanticArtifact: { ...semanticArtifact, title: "Outdoor Digital Sphere in Indiana", slug: "/outdoor-digital-sphere/indiana/" }, referenceArtifactHtml, mediaAssignments: [assignment("PRODUCT_AUTHORITY", "hero"), assignment("CONTEXTUAL_IN_USE", "support"), assignment("APPLICATION_EXPERIENCE", "support")], profile });
    expect(result.artifact.title).toBe("Outdoor Digital Sphere in Indiana");
    const source = readFileSync(join(process.cwd(), "src/modules/glw/target-rich-reference-artifact-producer.ts"), "utf8");
    expect(source).not.toMatch(/\bAlaska\b|\bIndiana\b|20114|20115/);
    const presentationSource = readFileSync(join(process.cwd(), "src/modules/glw/led-display-warehouse-presentation-authority.ts"), "utf8");
    expect(presentationSource).not.toMatch(/\bAlabama\b|\bAlaska\b|\bIndiana\b|20129|20114/);
  });
});
