import fs from "node:fs";
import path from "node:path";

describe("site intelligence UI contract", () => {
  const workspace = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteIntelligenceWorkspace.tsx"), "utf8");
  const ownerWorkflow = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteCapabilityOwnerWorkflow.tsx"), "utf8");
  const ownerVocabulary = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/site-capability-owner-ux.ts"), "utf8");
  const creativeWorkflow = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteCreativeDirectionWorkflow.tsx"), "utf8");
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
    for (const text of ["Market", "Should we pursue this?", "YES - PURSUE", "Current capability", "Can we actually provide this today?", "This does not reject the market."]) expect(ownerWorkflow).toContain(text);
    for (const text of ["YES - CURRENT CAPABILITY", "YES - WITH LIMITATIONS", "NOT YET"]) expect(ownerVocabulary).toContain(text);
    expect(ownerWorkflow).toContain('action: decision === "RESEARCH_MORE" ? "RESEARCH_MORE" : "DECIDE_OPPORTUNITY"');
    expect(ownerWorkflow).toContain('action: "VALIDATE_CAPABILITY"');
    expect(ownerWorkflow).toContain("canonicalCapabilityState(capabilityChoice)");
    expect(ownerWorkflow).toContain('role="status"');
  });

  test("approved intelligence exposes a generated strategy transition instead of mandatory manual entry", () => {
    for (const text of ["Site Intelligence Review Complete", "Strategy Readiness", "Opportunities approved", "Capabilities verified", "Capabilities qualified", "PROPOSE SITE STRATEGY", "Complete these requirements:", "EDIT AS NEW REVISION", "REQUEST REVISION"]) expect(workspace).toContain(text);
    expect(workspace).toContain('action: "GENERATE_STRATEGY"');
    expect(workspace).toContain('workspace.intelligenceState !== "INTELLIGENCE_APPROVED"');
    expect(workspace).toContain('opportunity.ownerDecision === "APPROVED"');
  });

  test("normal capability flow uses owner language while preserving advanced canonical evidence details", () => {
    for (const text of ["How can we support this?", "What does this show?", "Advanced evidence details", "General references do not establish independent proof", "What are the limitations?", "SAVE CAPABILITY REVIEW"]) expect(ownerWorkflow).toContain(text);
    expect(ownerWorkflow).toContain('type="checkbox"');
    expect(ownerWorkflow).toContain("OWNER_EVIDENCE_CHOICES");
    expect(ownerWorkflow).toContain("CAPABILITY_RELEVANCE_TYPES");
    expect(ownerWorkflow.indexOf("OWNER_EVIDENCE_CHOICES")).toBeLessThan(ownerWorkflow.indexOf("Advanced evidence details"));
  });

  test("owner confirmation is dynamic and legacy authority remains review-required", () => {
    expect(ownerWorkflow).toContain("I confirm that ${publicBrandIdentity} currently has this capability.");
    expect(ownerWorkflow).not.toContain("I confirm that Rocklin Metal currently has this capability.");
    expect(ownerWorkflow).toContain("REVIEW REQUIRED");
    expect(ownerWorkflow).toContain("proof requirements were upgraded");
    expect(ownerWorkflow).toContain('getCapabilityAuthorityStatus(opportunity) === "AUTHORITY_REVIEW_REQUIRED"');
    expect(ownerWorkflow).toContain("Owner confirmation is recorded as owner authority.");
    expect(ownerWorkflow).toContain("Independent proof may be added now or later.");
    expect(ownerWorkflow).toContain("This protected claim also requires independent proof.");
    expect(ownerWorkflow).toContain("latestAuthority?.attestation.trim()");
  });

  test("post-capability review always exposes the canonical next step", () => {
    for (const text of ["Capability review incomplete", "REVIEW REMAINING CAPABILITIES", "Capability review complete", "REVIEW UPDATED STRATEGY", "CONTINUE TO CREATIVE DIRECTION", "All required capability decisions are complete."]) expect(workspace).toContain(text);
    expect(workspace).toContain("resolvePostCapabilityTransition(workspace)");
    expect(workspace).toContain('action: "REFRESH_STRATEGY"');
    expect(workspace).toContain('href="#creative-direction"');
    expect(workspace).toContain("selectDistinctCapabilityOpportunities(workspace.opportunities)");
  });

  test("active proposed strategy exposes immediate and persistent owner decision controls", () => {
    for (const text of ["Updated strategy ready for review", "Current revision:", "Status: READY FOR REVIEW", "APPROVE STRATEGY", "REQUEST CHANGES", "REJECT", "CURRENTLY AWAITING OWNER DECISION", "Historical revision", "Active review"]) expect(workspace).toContain(text);
    expect(workspace).toContain('placement="top"');
    expect(workspace).toContain('placement="bottom"');
    expect(workspace.indexOf('placement="top"')).toBeLessThan(workspace.indexOf("<RichStrategyReview proposal={proposal}"));
    expect(workspace.indexOf('placement="bottom"')).toBeGreaterThan(workspace.indexOf("<RichStrategyReview proposal={proposal}"));
  });

  test("strategy refresh focuses review and request changes requires explicit instructions", () => {
    for (const text of ["What should Genesis change?", "GENERATE REVISED STRATEGY", "STRATEGY_REVISION_INSTRUCTIONS_REQUIRED"]) expect(`${workspace}${fs.readFileSync(path.join(process.cwd(), "src/app/api/sites/[siteId]/intelligence/route.ts"), "utf8")}`).toContain(text);
    expect(workspace).toContain('document.getElementById("strategy-review")');
    expect(workspace).toContain('review?.focus({ preventScroll: true })');
    expect(workspace).toContain('review?.scrollIntoView({ behavior: "smooth", block: "start" })');
    expect(workspace).toContain('href="#creative-direction"');
  });

  test("rich strategy review renders all canonical owner-facing dimensions and valid state actions", () => {
    for (const text of ["Positioning", "Audiences", "Value Proposition", "Market / Vertical Priorities", "Product / Service Families", "Opportunity Prioritization", "Sales Channels", "Expansion / SEO Geography", "Geographic Strategy", "Sitemap", "Conversion Paths", "CTA Hierarchy", "Proof / Trust Requirements", "Required Product Authority", "Homepage Goals", "Internal Authority and Synthesis Context", "GENERATE REVISED STRATEGY"]) expect(workspace).toContain(text);
    expect(workspace).toContain('proposal.status === "PROPOSED"');
    expect(workspace).toContain('proposal.status === "REVISION_REQUESTED"');
  });

  test("creative direction starts with assisted generation instead of mandatory technical fields", () => {
    for (const text of ["Genesis will build a visual and structural direction", "Approved strategy", "Creative references", "Anything you want Genesis to emphasize or avoid?", "GENERATE CREATIVE DIRECTION", "Inspiration / reference only", "Not publishable"]) expect(creativeWorkflow).toContain(text);
    expect(creativeWorkflow).toContain('action: "GENERATE_CREATIVE_DIRECTION"');
    expect(creativeWorkflow).not.toContain("disabled={busy || !direction.trim()}");
  });

  test("creative review exposes structured proposal and top/bottom owner decisions", () => {
    for (const text of ["Creative Direction ready for review", "Current revision:", "Status: READY FOR REVIEW", "Overall Visual Direction", "Color Direction", "Typography Direction", "Layout Direction", "Photography / Visual Asset Style", "Homepage Blueprint", "Product / Service Presentation", "Market / Vertical Presentation", "Conversion Direction", "Creative Guardrails", "APPROVE CREATIVE DIRECTION", "REQUEST CHANGES", "REJECT"]) expect(creativeWorkflow).toContain(text);
    expect(creativeWorkflow).toContain('placement="top"');
    expect(creativeWorkflow).toContain('placement="bottom"');
    expect(creativeWorkflow.indexOf('placement="top"')).toBeLessThan(creativeWorkflow.indexOf("<CreativeProposalReview proposal={proposal}"));
    expect(creativeWorkflow.indexOf('placement="bottom"')).toBeGreaterThan(creativeWorkflow.indexOf("<CreativeProposalReview proposal={proposal}"));
  });

  test("creative revisions and approval expose explicit next stages", () => {
    for (const text of ["What should Genesis change?", "GENERATE REVISED CREATIVE DIRECTION", "Creative Direction approved", "CONTINUE TO PRODUCT / SERVICE AUTHORITY", "Site generation remains disabled until bounded product onboarding is complete."]) expect(creativeWorkflow).toContain(text);
    expect(creativeWorkflow).toContain('generate("GENERATE_REVISED_CREATIVE_DIRECTION")');
    expect(creativeWorkflow).toContain("/products/new?organizationId=");
    expect(creativeWorkflow).toContain('action: "DECIDE_CREATIVE"');
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