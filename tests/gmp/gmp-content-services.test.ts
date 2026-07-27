import { describe, expect, it } from "@jest/globals";
import { createGmpProject } from "@/lib/gmp/models";
import { createInMemoryGmpRepository } from "@/lib/gmp/repository";
import { createInMemoryGmpKnowledgeRepository } from "@/lib/gmp/knowledge-repository";
import { createInMemoryGmpPageRepository } from "@/lib/gmp/page-repository";
import { buildPage } from "@/lib/gmp/page-models";
import { stableInputFingerprint } from "@/lib/gmp/content-models";
import { createInMemoryGmpContentRepository } from "@/lib/gmp/content-repository";
import { createGmpContentServices } from "@/lib/gmp/content-services";
import { createDeterministicGmpGenerationProvider, type GmpGenerationProvider } from "@/lib/gmp/content-provider";

async function seedContentContext(input?: { pageType?: "home" | "product" }) {
  const project = createGmpProject({ name: "Content Project", workspaceId: "glw-led-display-warehouse", ownerActorId: "admin@example.com", slug: `content-project-${input?.pageType ?? "home"}` });
  const projectRepository = createInMemoryGmpRepository({ projects: [project] });
  const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
  const pageRepository = createInMemoryGmpPageRepository();
  const contentRepository = createInMemoryGmpContentRepository();
  const site = await projectRepository.createSite({ projectId: project.projectId, displayName: "Main Site", primaryDomain: "example.com", environment: "production", publishingPlatform: "wordpress", publishingStatus: "CONNECTED", authenticationMethod: "token", connectionStatus: "HEALTHY", publishingCapabilities: ["draft", "publish"], defaultLanguage: "en", defaultTheme: "core" });
  await projectRepository.upsertBrandProfile({ projectId: project.projectId, companyName: "Acme", tagline: "Trusted", mission: "Mission", brandVoice: "Direct", writingStyle: "Editorial", primaryAudience: "Operators", secondaryAudience: "Buyers", primaryColor: "#000", secondaryColor: "#fff", logoReferences: [], typography: {}, assetReferences: [], socialLinks: [], contactInformation: {}, metadata: {} });
  const workspace = await knowledgeRepository.ensureWorkspace(project.projectId);
  const approvedClaim = await knowledgeRepository.createRecord({ projectId: project.projectId, knowledgeWorkspaceId: workspace.knowledgeWorkspaceId, domain: "claims", recordType: "claim", canonicalKey: "approved_claim", title: "Approved Claim", summary: "Approved claim", structuredValue: { text: "approved claim" }, normalizedValue: { text: "approved claim" }, status: "APPROVED", confidence: 90, priority: 80, effectiveFrom: null, effectiveUntil: null, sourceCount: 1, conflictState: "NONE", reviewState: "APPROVED", parentRecordId: null, supersededByRecordId: null, archivedAt: null, metadata: {} });
  const page = await pageRepository.createPage(buildPage({ projectId: project.projectId, siteId: site.siteId, actorId: "admin@example.com", pageType: input?.pageType ?? "product", name: "Generated Page", title: "Generated Page" }));
  const brief = await pageRepository.createBrief({ projectId: project.projectId, pageId: page.pageId, status: "APPROVED", purpose: "Explain product", audience: "Engineers", userNeed: "Compare options", businessGoal: "Generate leads", primaryTopic: "Industrial LEDs", secondaryTopics: [], primaryKeyword: "industrial leds", secondaryKeywords: [], searchIntent: "commercial", funnelStage: "consideration", valueProposition: "Reliable systems", requiredClaims: [approvedClaim.canonicalKey], requiredProofPoints: ["lab_report"], requiredProductsOrServices: [], requiredApplications: [], requiredIndustries: [], requiredTechnicalSpecifications: [], requiredFaqs: [], restrictedMessaging: ["best-in-world"], conversionGoal: "contact", primaryCta: "Contact Sales", secondaryCta: "Download Spec", competitorContext: {}, toneGuidance: "direct", evidenceRequirements: ["spec-sheet"], knowledgeRecordReferences: [approvedClaim.knowledgeRecordId], sourceReferences: ["source-1"], approvedAt: new Date().toISOString(), approvedBy: "admin@example.com", archivedAt: null, metadata: {} });
  await pageRepository.updatePage(page.pageId, { currentBriefId: brief.briefId });
  const plan = await pageRepository.createContentPlan({ projectId: project.projectId, pageId: page.pageId, pageBriefId: brief.briefId, status: "APPROVED", planningModelVersion: "test-plan", targetWordRange: { min: 600, max: 900 }, readingLevel: "professional", requiredSectionCount: input?.pageType === "product" ? 5 : 4, optionalSectionCount: input?.pageType === "product" ? 1 : 0, sectionOrder: input?.pageType === "product" ? ["hero", "features", "specifications", "use_cases", "faq", "cta"] : ["hero", "overview", "benefits", "proof", "cta"], internalLinkRequirements: [], externalEvidenceRequirements: ["spec-sheet"], structuredDataRequirements: [], mediaRequirements: [], ctaRequirements: ["Contact Sales"], seoRequirements: ["primary_keyword"], accessibilityRequirements: ["semantic_headings"], approvalRequirements: ["brief_approved"], readinessScore: 90, approvedAt: new Date().toISOString(), approvedBy: "admin@example.com", archivedAt: null, metadata: {} });
  await pageRepository.updatePage(page.pageId, { currentContentPlanId: plan.contentPlanId });
  const sectionOrder = plan.sectionOrder;
  await pageRepository.replaceSectionsForPlan(plan.contentPlanId, page.pageId, project.projectId, sectionOrder.map((key, index) => ({ projectId: project.projectId, pageId: page.pageId, contentPlanId: plan.contentPlanId, parentSectionId: undefined, sectionType: key === "hero" ? "hero" : key === "cta" ? "cta" : key === "faq" ? "faq" : key === "features" ? "features" : key === "specifications" ? "specifications" : key === "use_cases" ? "use_cases" : key === "proof" ? "proof" : "overview", sectionKey: key, position: index + 1, headingLevel: index === 0 ? 1 : 2, workingHeading: key.toUpperCase(), purpose: brief.purpose, audienceNeed: brief.userNeed, requiredKnowledgeRecords: [approvedClaim.knowledgeRecordId], requiredClaims: [approvedClaim.canonicalKey], requiredEvidence: ["source-1"], requiredProducts: [], requiredServices: [], requiredSpecifications: [], requiredFaqs: [], targetWordRange: { min: 50, max: 150 }, ctaType: key === "cta" ? "primary" : undefined, mediaRequirement: {}, internalLinkRequirement: {}, structuredDataContribution: {}, optional: key === "faq", status: "PLANNED", metadata: {} })));
  await pageRepository.createReadinessAssessment({ projectId: project.projectId, pageId: page.pageId, scoringModelVersion: "test", overallScore: 92, planningReadiness: 92, knowledgeReadiness: 92, seoReadiness: 92, evidenceReadiness: 92, linkingReadiness: 92, blockingIssues: [], warnings: [], recommendations: [], metadata: {} });
  return { project, projectRepository, knowledgeRepository, pageRepository, contentRepository, page };
}

describe("gmp content services", () => {
  it("evaluates deterministic eligibility and fingerprints", async () => {
    const { projectRepository, knowledgeRepository, pageRepository, contentRepository, page } = await seedContentContext();
    const services = createGmpContentServices({ projectRepository, knowledgeRepository, pageRepository, contentRepository });
    const eligibility = await services.evaluateEligibility(page.pageId);

    expect(eligibility?.eligible).toBe(true);
    expect(eligibility?.blockingIssues).toEqual([]);
    expect(stableInputFingerprint({ a: 1, b: [2, 3] })).toBe(stableInputFingerprint({ a: 1, b: [2, 3] }));
  });

  it("creates drafts and generates section content end to end", async () => {
    const { projectRepository, knowledgeRepository, pageRepository, contentRepository, page } = await seedContentContext();
    const services = createGmpContentServices({ projectRepository, knowledgeRepository, pageRepository, contentRepository });
    const draft = await services.createDraftForPage({ pageId: page.pageId, actorId: "admin@example.com" });
    expect(draft).not.toBeNull();

    const generated = await services.generateDraft({ draftId: draft!.contentDraftId, actorId: "admin@example.com" });
    expect(generated.sections.length).toBeGreaterThan(0);
    expect(generated.validation.overallScore).toBeGreaterThan(0);

    const status = await services.getGenerationStatus(draft!.contentDraftId);
    expect(status).not.toBeNull();
  });

  it("preserves partial success when one section generation fails", async () => {
    const seeded = await seedContentContext({ pageType: "product" });
    const failingProvider: GmpGenerationProvider = {
      ...createDeterministicGmpGenerationProvider(),
      async generateSection(input, prompt) {
        if (String(input.section.sectionKey) === "faq") {
          throw new Error("faq failed");
        }
        return createDeterministicGmpGenerationProvider().generateSection(input, prompt);
      },
    };
    const services = createGmpContentServices({ ...seeded, provider: failingProvider });
    const draft = await services.createDraftForPage({ pageId: seeded.page.pageId, actorId: "admin@example.com" });
    const generated = await services.generateDraft({ draftId: draft!.contentDraftId, actorId: "admin@example.com" });

    expect(generated.sections.length).toBeGreaterThan(0);
    expect(generated.draft.generationStatus).toBe("PARTIALLY_GENERATED");
  });

  it("blocks draft approval until sections are approved", async () => {
    const seeded = await seedContentContext();
    const services = createGmpContentServices(seeded);
    const draft = await services.createDraftForPage({ pageId: seeded.page.pageId, actorId: "admin@example.com" });
    await services.generateDraft({ draftId: draft!.contentDraftId, actorId: "admin@example.com" });
    await services.validateDraft(draft!.contentDraftId);

    const blocked = await services.approveDraft(draft!.contentDraftId, "admin@example.com");
    expect(blocked).toBeNull();
  });
});