import fs from "node:fs";
import path from "node:path";

describe("site intelligence UI contract", () => {
  const workspace = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteIntelligenceWorkspace.tsx"), "utf8");
  const library = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteIntelligenceReferenceLibrary.tsx"), "utf8");
  const onboarding = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/FreshSiteOnboardingFlow.tsx"), "utf8");
  const route = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/intelligence/page.tsx"), "utf8");

  test("completed onboarding recommends intelligence before product authority", () => {
    expect(onboarding).toContain("START SITE INTELLIGENCE");
    expect(onboarding).toContain("Expert bypass");
    expect(onboarding.indexOf("START SITE INTELLIGENCE")).toBeLessThan(onboarding.indexOf("Add Product by URL"));
  });

  test("real identity transition preserves internal ID and public brand", () => {
    expect(route).toContain("getIntegrationProfileById");
    expect(route).toContain("brandProfile?.organizationId === site?.organizationId");
    expect(route).not.toContain('site.organizationId === "rj-metal"');
    expect(workspace).toContain("Internal organization");
    expect(workspace).toContain("Public brand");
  });

  test("workspace exposes intelligence, strategy, creative and approval controls", () => {
    for (const text of ["Opportunity Board", "APPROVE INTELLIGENCE", "Site Strategy", "Creative Inputs", "Creative Direction", "Product authority boundary"]) expect(workspace).toContain(text);
    for (const decision of ["RESEARCH_MORE", "HOLD", "REJECTED", "APPROVED", "VERIFIED", "QUALIFIED", "FUTURE_CAPABILITY"]) expect(workspace).toContain(decision);
  });

  test("opportunity controls distinguish market actions, selected state, and capability evidence feedback", () => {
    for (const text of ["Market Opportunity Decision", "Capability Authority", "APPROVE", "RESEARCH MORE", "HOLD", "REJECT", "Opportunity approved.", "Opportunity marked Research More.", "GENERAL REFERENCE alone cannot verify or qualify a capability.", "Cannot mark capability"] ) expect(workspace).toContain(text);
    expect(workspace).toContain("aria-pressed={selected}");
    expect(workspace).toContain('action: decision === "RESEARCH_MORE" ? "RESEARCH_MORE" : "DECIDE_OPPORTUNITY"');
    expect(workspace).toContain('action: "VALIDATE_CAPABILITY"');
    expect(workspace).toContain('role="status"');
  });

  test("approved intelligence exposes a generated strategy transition instead of mandatory manual entry", () => {
    for (const text of ["Site Intelligence Review Complete", "Strategy Readiness", "Opportunities approved", "Capabilities verified", "Capabilities qualified", "PROPOSE SITE STRATEGY", "Complete these requirements:", "EDIT AS NEW REVISION", "REQUEST REVISION"]) expect(workspace).toContain(text);
    expect(workspace).toContain('action: "GENERATE_STRATEGY"');
    expect(workspace).toContain('workspace.intelligenceState !== "INTELLIGENCE_APPROVED"');
    expect(workspace).toContain('opportunity.ownerDecision === "APPROVED"');
  });

  test("capability authority uses a typed multi-select evidence picker", () => {
    for (const text of ["Supporting evidence and relevance", "Add an owner-supplied URL or upload", "Owner attestation", "Evidence relevance", "GENERAL REFERENCE alone", "AUTHORITY_REVIEW_REQUIRED", "RETURN TO OWNER REVIEW", "option.sourceType", "option.provenance"]) expect(workspace).toContain(text);
    expect(workspace).toContain('type="checkbox"');
    expect(workspace).toContain("CAPABILITY_RELEVANCE_TYPES");
    expect(workspace).toContain("capabilityEvidenceOptions");
    expect(workspace).not.toContain("Capability evidence reference<input");
  });

  test("rich strategy review renders all canonical owner-facing dimensions and valid state actions", () => {
    for (const text of ["Positioning", "Audiences", "Value Proposition", "Market / Vertical Priorities", "Product / Service Families", "Opportunity Prioritization", "Sales Channels", "Expansion / SEO Geography", "Geographic Strategy", "Sitemap", "Conversion Paths", "CTA Hierarchy", "Proof / Trust Requirements", "Required Product Authority", "Homepage Goals", "Internal Authority and Synthesis Context", "GENERATE REVISED STRATEGY"]) expect(workspace).toContain(text);
    expect(workspace).toContain('proposal.status === "PROPOSED"');
    expect(workspace).toContain('proposal.status === "REVISION_REQUESTED"');
  });

  test("workspace exposes real multiple-file upload with conservative classification", () => {
    expect(library).toContain('type="file"'); expect(library).toContain("multiple"); expect(library).toContain("UPLOAD {files.length");
    expect(library).toContain('useState<SiteAssetClassification>("OWNER_SUPPLIED_REFERENCE")');
    expect(library).toContain("Uploaded Assets"); expect(library).toContain("not publishable");
  });

  test("workspace exposes a repeatable multi-reference library with independent metadata", () => {
    for (const text of ["Reference Library", "ADD REFERENCE", "Web References", "Likes", "Dislikes", "Reference only", "EDIT", "REJECT / ARCHIVE", "Purpose / notes", "Provenance"]) expect(library).toContain(text);
    for (const value of ["OWNER_SUPPLIED_REFERENCE", "EXTERNAL_INSPIRATION_ONLY", "COMPETITOR_REFERENCE_ONLY", "OWNER_APPROVED_PUBLISHABLE", "UNVERIFIED", "REJECTED", "LIKE", "DISLIKE", "REFERENCE_ONLY"]) expect(library).toContain(value);
    expect(workspace).toContain("SiteIntelligenceReferenceLibrary");
    expect(library).toContain('action: "ADD_URL_REFERENCE"');
    expect(library).toContain('action: "UPDATE_CREATIVE_INPUT"');
    expect(library).toContain('setReference("")');
    expect(library).toContain('setNotes("")');
  });

  test("workspace has no campaign, product creation, generation, or WordPress mutation endpoint", () => {
    expect(workspace).not.toContain("/api/glw/");
    expect(workspace).not.toContain("/api/products");
    expect(workspace).not.toContain("wp-json");
    expect(library).not.toContain("wp-json");
    expect(workspace).toContain("Generation remains disabled in V1");
    expect(onboarding).toContain('useState<SitePublicationPolicy>("draft_only")');
  });
});