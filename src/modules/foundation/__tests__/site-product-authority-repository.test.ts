import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SiteStrategyProposal } from "../site-intelligence";
import type { ProductConfiguration } from "../types";

const scope = { organizationId: "rj-metal", siteId: "site-rj", actor: "owner" };
function strategy(overrides: Partial<SiteStrategyProposal> = {}): SiteStrategyProposal {
  return {
    revision: 8,
    positioning: "Position",
    primaryAudience: "Commercial buyers",
    secondaryAudiences: [],
    valueProposition: "Value",
    majorVerticals: [],
    productServiceFamilies: ["Stainless Countertops", "Stainless Countertop", "Design-Build Fabrication", "Commercial Worktables And Prep Tables"],
    informationArchitecture: [],
    proposedSitemap: [],
    homepageGoals: [],
    conversionPaths: [],
    ctaHierarchy: [],
    trustProofRequirements: [],
    geographicStrategy: "Regional",
    proposedProductAuthority: [],
    status: "APPROVED",
    reason: "Approved",
    createdBy: "owner",
    createdAt: "2026-09-11T00:00:00.000Z",
    decidedBy: "owner",
    decidedAt: "2026-09-11T00:01:00.000Z",
    ...overrides,
  };
}

function mockCanonicalProduct(input: {
  productId: string;
  organizationId: string;
  siteId: string;
  enabled?: boolean;
  lifecycleState?: ProductConfiguration["lifecycleState"];
  catalogStatus?: ProductConfiguration["catalogStatus"];
  visibility?: ProductConfiguration["visibility"];
  assignmentEnabled?: boolean;
  assignmentVisibility?: ProductConfiguration["visibility"];
  assignmentPublicationStatus?: ProductConfiguration["siteAssignments"][number]["publicationStatus"];
  productName?: string;
  slug?: string;
  specifications?: ProductConfiguration["specifications"];
}): ProductConfiguration {
  const productName = input.productName ?? "Fan Cooled Projector Enclosures";
  const slug = input.slug ?? "fan-cooled-projector-enclosures";
  return {
    productId: input.productId,
    organizationId: input.organizationId,
    productName,
    displayName: productName,
    slug,
    sku: `SKU-${input.productId}`,
    modelNumber: null,
    shortDescription: "Canonical product short description.",
    fullDescription: "Canonical product full description.",
    productType: "projector_enclosure",
    productFamily: "projector-enclosures",
    categoryIds: ["cat-1"],
    manufacturerId: null,
    brandReference: null,
    lifecycleState: input.lifecycleState ?? "active",
    catalogStatus: input.catalogStatus ?? "ready",
    enabled: input.enabled ?? true,
    visibility: input.visibility ?? "public_candidate",
    featured: false,
    primarySiteId: input.siteId,
    assignedSiteIds: [input.siteId],
    siteAssignments: [{
      siteId: input.siteId,
      enabledForSite: input.assignmentEnabled ?? true,
      siteSpecificSlug: slug,
      siteSpecificDisplayName: productName,
      siteSpecificShortDescription: null,
      visibility: input.assignmentVisibility ?? "public_candidate",
      featured: false,
      sortOrder: 0,
      categoryIds: ["cat-1"],
      defaultContentType: "product_update",
      publicationStatus: input.assignmentPublicationStatus ?? "ready",
      seoProfileReference: null,
      promptProfileReference: null,
      imageProfileReference: null,
      pricingDisplayMode: "hidden",
      lastReadinessEvaluation: null,
      lastPublicationReference: null,
    }],
    media: { primaryImageReference: null, galleryImageReferences: [], videoReferences: [] },
    documents: { technicalDrawingReferences: [], specSheetReferences: [], brochureReferences: [], manualReferences: [], installationGuideReferences: [], warrantyDocumentReferences: [] },
    specifications: input.specifications ?? [{ specificationId: "spec-cooling", specificationGroup: "Cooling", key: "cooling_method", displayLabel: "Cooling Method", rawValue: "Built-In Fan Cooling", normalizedValue: "Fan Cooled", unit: null, sortOrder: 1, sourceReference: null, evidenceReference: null, confidence: 1, visibility: "public" }],
    seoProfileReference: null,
    promptProfileReference: null,
    businessGenomeObjectReference: null,
    sourceEvidenceReference: null,
    authorityProvenance: null,
    createdAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
    publishedAt: null,
    notes: null,
  };
}

describe("site product/service authority repository", () => {
  const old = process.env.GCP_FOUNDATION_PERSISTENCE_DIR; let directory: string;
  beforeEach(() => { jest.resetModules(); jest.dontMock("../product-repository"); directory = fs.mkdtempSync(path.join(os.tmpdir(), "site-product-authority-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = old; fs.rmSync(directory, { recursive: true, force: true }); });

  test("joins eligible canonical products as pending candidates with product identity and specifications", async () => {
    const canonicalScope = { organizationId: "ssi", siteId: "site-ssi-projectorenclosure", actor: "owner" };
    jest.doMock("../product-repository", () => ({
      listProducts: () => [
        mockCanonicalProduct({ productId: "prod-ssi-fan-cooled-projector-enclosures", organizationId: "ssi", siteId: "site-ssi-projectorenclosure" }),
      ],
    }));
    const repository = await import("../site-product-authority-repository");
    const workspace = repository.getSiteAuthorityWorkspace({ ...canonicalScope, strategy: strategy({ productServiceFamilies: [] }) });
    expect(workspace.candidates).toHaveLength(1);
    expect(workspace.candidates[0]).toMatchObject({
      decision: "PENDING",
      provenance: { kind: "CANONICAL_PRODUCT_REGISTRY", referenceId: "prod-ssi-fan-cooled-projector-enclosures" },
      canonicalProductId: "prod-ssi-fan-cooled-projector-enclosures",
      canonicalProductSlug: "fan-cooled-projector-enclosures",
      canonicalSiteAssignment: {
        siteId: "site-ssi-projectorenclosure",
        enabledForSite: true,
        visibility: "public_candidate",
        publicationStatus: "ready",
      },
    });
    expect(workspace.candidates[0].canonicalSpecifications).toEqual(expect.arrayContaining([expect.objectContaining({ displayLabel: "Cooling Method", rawValue: "Built-In Fan Cooling" })]));
    expect(repository.listGenerationAuthority(canonicalScope)).toEqual([]);
  });

  test("canonical candidates require explicit owner approval and are never auto-approved", async () => {
    const canonicalScope = { organizationId: "ssi", siteId: "site-ssi-projectorenclosure", actor: "owner" };
    jest.doMock("../product-repository", () => ({
      listProducts: () => [
        mockCanonicalProduct({ productId: "prod-ssi-fan-cooled-projector-enclosures", organizationId: "ssi", siteId: "site-ssi-projectorenclosure" }),
      ],
    }));
    const repository = await import("../site-product-authority-repository");
    const workspace = repository.getSiteAuthorityWorkspace({ ...canonicalScope, strategy: strategy({ productServiceFamilies: [] }) });
    const candidate = workspace.candidates[0];
    expect(candidate.decision).toBe("PENDING");
    expect(repository.listGenerationAuthority(canonicalScope)).toEqual([]);
    const approved = repository.decideAuthorityCandidate({
      ...canonicalScope,
      strategy: strategy({ productServiceFamilies: [] }),
      authorityId: candidate.authorityId,
      type: "PRODUCT",
      displayName: candidate.displayName,
      description: candidate.description,
      limitations: "",
      decision: "APPROVED",
      ownerAttestation: "Owner confirms this canonical product is currently offered.",
      sourceIds: [],
      actor: "owner",
    });
    expect(approved.canonicalProductId).toBe("prod-ssi-fan-cooled-projector-enclosures");
    expect(repository.listGenerationAuthority(canonicalScope)).toEqual(expect.arrayContaining([expect.objectContaining({ authorityId: candidate.authorityId })]));
  });

  test("canonical eligibility filters and source dedupe preserve governance boundaries", async () => {
    const canonicalScope = { organizationId: "ssi", siteId: "site-ssi-projectorenclosure", actor: "owner" };
    jest.doMock("../product-repository", () => ({
      listProducts: () => [
        mockCanonicalProduct({ productId: "prod-eligible", organizationId: "ssi", siteId: "site-ssi-projectorenclosure", productName: "Fan Cooled Projector Enclosures", slug: "fan-cooled-projector-enclosures" }),
        mockCanonicalProduct({ productId: "prod-other-site", organizationId: "ssi", siteId: "site-elsewhere" }),
        mockCanonicalProduct({ productId: "prod-disabled", organizationId: "ssi", siteId: "site-ssi-projectorenclosure", enabled: false }),
        mockCanonicalProduct({ productId: "prod-not-ready", organizationId: "ssi", siteId: "site-ssi-projectorenclosure", catalogStatus: "incomplete" }),
        mockCanonicalProduct({ productId: "prod-assignment-disabled", organizationId: "ssi", siteId: "site-ssi-projectorenclosure", assignmentEnabled: false }),
        mockCanonicalProduct({ productId: "prod-assignment-not-ready", organizationId: "ssi", siteId: "site-ssi-projectorenclosure", assignmentPublicationStatus: "not_ready" }),
        mockCanonicalProduct({ productId: "prod-other-org", organizationId: "other-org", siteId: "site-ssi-projectorenclosure" }),
      ],
    }));
    const repository = await import("../site-product-authority-repository");
    const strategyProposal = strategy({ productServiceFamilies: [] });

    let workspace = repository.getSiteAuthorityWorkspace({ ...canonicalScope, strategy: strategyProposal });
    expect(workspace.candidates.map((item) => item.canonicalProductId)).toEqual(["prod-eligible"]);

    const sameIdentitySource = repository.addOwnerKnowledgeSource({
      ...canonicalScope,
      label: "Home",
      statement: "Fan Cooled Projector Enclosures",
      sourceRole: "PRODUCT_SERVICE_AUTHORITY",
      actor: "owner",
    });
    expect(() => repository.proposeAuthorityCandidatesFromSources({ ...canonicalScope, strategy: strategyProposal, actor: "owner", sourceIds: [sameIdentitySource.sourceId] })).toThrow("SOURCE_CANDIDATE_PROPOSAL_INSUFFICIENT_EVIDENCE");

    const unrelatedSource = repository.addOwnerKnowledgeSource({
      ...canonicalScope,
      label: "Secondary offer",
      statement: "Outdoor Projection Consulting",
      sourceRole: "PRODUCT_SERVICE_AUTHORITY",
      actor: "owner",
    });
    const proposed = repository.proposeAuthorityCandidatesFromSources({ ...canonicalScope, strategy: strategyProposal, actor: "owner", sourceIds: [unrelatedSource.sourceId] });
    expect(proposed).toEqual(expect.arrayContaining([expect.objectContaining({ decision: "PENDING", provenance: expect.objectContaining({ kind: "SOURCE" }) })]));

    workspace = repository.getSiteAuthorityWorkspace({ ...canonicalScope, strategy: strategyProposal });
    expect(workspace.candidates.some((item) => item.canonicalProductId === "prod-eligible")).toBe(true);
    expect(workspace.candidates.some((item) => item.provenance?.kind === "SOURCE" && item.displayName === "Outdoor Projection Consulting")).toBe(true);
    expect(workspace.candidates.some((item) => item.displayName === "Fan Cooled Projector Enclosures" && item.provenance?.kind === "SOURCE")).toBe(false);
  });

  test("carries forward an equivalent approved source decision when a newer strategy derives the same offering identity", async () => {
    jest.doMock("../product-repository", () => ({ listProducts: () => [] }));
    const repository = await import("../site-product-authority-repository");
    const strategy2 = strategy({ revision: 2, productServiceFamilies: [] });
    const source = repository.addOwnerKnowledgeSource({
      ...scope,
      label: "Projector authority",
      statement: "Projector Enclosure",
      sourceRole: "PRODUCT_SERVICE_AUTHORITY",
      actor: "owner",
    });
    const proposed = repository.proposeAuthorityCandidatesFromSources({ ...scope, strategy: strategy2, actor: "owner", sourceIds: [source.sourceId] });
    const projector = proposed.find((item) => item.slug === "projector-enclosure");
    expect(projector).toBeDefined();

    repository.decideAuthorityCandidate({
      ...scope,
      strategy: strategy2,
      authorityId: projector!.authorityId,
      type: projector!.type,
      displayName: projector!.displayName,
      description: projector!.description,
      limitations: "",
      decision: "APPROVED",
      ownerAttestation: "Owner confirms this offering.",
      sourceIds: [source.sourceId],
      actor: "owner",
    });

    const strategy3 = strategy({ revision: 3, productServiceFamilies: ["Projector Enclosure"] });
    const workspace = repository.getSiteAuthorityWorkspace({ ...scope, strategy: strategy3 });
    const projectorCandidates = workspace.candidates.filter((item) => item.slug === "projector-enclosure");
    expect(projectorCandidates).toHaveLength(1);
    expect(projectorCandidates[0]).toMatchObject({ decision: "APPROVED", sourceIds: [source.sourceId] });
  });

  test("does not silently override a rejected decision when a newer strategy derives the same offering identity", async () => {
    jest.doMock("../product-repository", () => ({ listProducts: () => [] }));
    const repository = await import("../site-product-authority-repository");
    const strategy2 = strategy({ revision: 2, productServiceFamilies: [] });
    const source = repository.addOwnerKnowledgeSource({
      ...scope,
      label: "Projector authority",
      statement: "Projector Enclosure",
      sourceRole: "PRODUCT_SERVICE_AUTHORITY",
      actor: "owner",
    });
    const proposed = repository.proposeAuthorityCandidatesFromSources({ ...scope, strategy: strategy2, actor: "owner", sourceIds: [source.sourceId] });
    const projector = proposed.find((item) => item.slug === "projector-enclosure");
    expect(projector).toBeDefined();

    repository.decideAuthorityCandidate({
      ...scope,
      strategy: strategy2,
      authorityId: projector!.authorityId,
      type: projector!.type,
      displayName: projector!.displayName,
      description: projector!.description,
      limitations: "",
      decision: "REJECTED",
      ownerAttestation: "",
      sourceIds: [],
      actor: "owner",
    });

    const strategy3 = strategy({ revision: 3, productServiceFamilies: ["Projector Enclosure"] });
    const workspace = repository.getSiteAuthorityWorkspace({ ...scope, strategy: strategy3 });
    const projectorCandidates = workspace.candidates.filter((item) => item.slug === "projector-enclosure");
    expect(projectorCandidates).toHaveLength(1);
    expect(projectorCandidates[0].decision).toBe("REJECTED");
  });

  test("keeps canonical authority precedence and avoids duplicate pending candidates for equivalent strategy identity", async () => {
    const canonicalScope = { organizationId: "ssi", siteId: "site-ssi-projectorenclosure", actor: "owner" };
    jest.doMock("../product-repository", () => ({
      listProducts: () => [
        mockCanonicalProduct({
          productId: "prod-ssi-projector-enclosure",
          organizationId: "ssi",
          siteId: "site-ssi-projectorenclosure",
          productName: "Projector Enclosure",
          slug: "projector-enclosure",
        }),
      ],
    }));
    const repository = await import("../site-product-authority-repository");
    const strategyProposal = strategy({ revision: 3, productServiceFamilies: ["Projector Enclosure"] });
    const pendingWorkspace = repository.getSiteAuthorityWorkspace({ ...canonicalScope, strategy: strategyProposal });
    const canonical = pendingWorkspace.candidates.find((item) => item.slug === "projector-enclosure");
    expect(canonical).toBeDefined();

    repository.decideAuthorityCandidate({
      ...canonicalScope,
      strategy: strategyProposal,
      authorityId: canonical!.authorityId,
      type: canonical!.type,
      displayName: canonical!.displayName,
      description: canonical!.description,
      limitations: "",
      decision: "APPROVED",
      ownerAttestation: "Owner confirms this canonical product is offered.",
      sourceIds: [],
      actor: "owner",
    });

    const approvedWorkspace = repository.getSiteAuthorityWorkspace({ ...canonicalScope, strategy: strategyProposal });
    const projectorCandidates = approvedWorkspace.candidates.filter((item) => item.slug === "projector-enclosure");
    expect(projectorCandidates).toHaveLength(1);
    expect(projectorCandidates[0]).toMatchObject({
      decision: "APPROVED",
      provenance: { kind: "CANONICAL_PRODUCT_REGISTRY", referenceId: "prod-ssi-projector-enclosure" },
    });
  });

  test("keeps materially different new strategy offerings pending while carrying forward equivalent decided offerings", async () => {
    jest.doMock("../product-repository", () => ({ listProducts: () => [] }));
    const repository = await import("../site-product-authority-repository");
    const strategy2 = strategy({ revision: 2, productServiceFamilies: [] });
    const source = repository.addOwnerKnowledgeSource({
      ...scope,
      label: "Projector authority",
      statement: "Projector Enclosure",
      sourceRole: "PRODUCT_SERVICE_AUTHORITY",
      actor: "owner",
    });
    const proposed = repository.proposeAuthorityCandidatesFromSources({ ...scope, strategy: strategy2, actor: "owner", sourceIds: [source.sourceId] });
    const projector = proposed.find((item) => item.slug === "projector-enclosure");
    expect(projector).toBeDefined();

    repository.decideAuthorityCandidate({
      ...scope,
      strategy: strategy2,
      authorityId: projector!.authorityId,
      type: projector!.type,
      displayName: projector!.displayName,
      description: projector!.description,
      limitations: "",
      decision: "APPROVED",
      ownerAttestation: "Owner confirms this offering.",
      sourceIds: [source.sourceId],
      actor: "owner",
    });

    const strategy3 = strategy({ revision: 3, productServiceFamilies: ["Projector Enclosure", "Projector Enclosure XL"] });
    const workspace = repository.getSiteAuthorityWorkspace({ ...scope, strategy: strategy3 });
    expect(workspace.candidates.find((item) => item.slug === "projector-enclosure")?.decision).toBe("APPROVED");
    expect(workspace.candidates.find((item) => item.slug === "projector-enclosure-xl")?.decision).toBe("PENDING");
  });

  test("does not carry decisions across organization or site boundaries", async () => {
    jest.doMock("../product-repository", () => ({ listProducts: () => [] }));
    const repository = await import("../site-product-authority-repository");
    const strategy2 = strategy({ revision: 2, productServiceFamilies: [] });
    const source = repository.addOwnerKnowledgeSource({
      ...scope,
      label: "Projector authority",
      statement: "Projector Enclosure",
      sourceRole: "PRODUCT_SERVICE_AUTHORITY",
      actor: "owner",
    });
    const proposed = repository.proposeAuthorityCandidatesFromSources({ ...scope, strategy: strategy2, actor: "owner", sourceIds: [source.sourceId] });
    const projector = proposed.find((item) => item.slug === "projector-enclosure");
    expect(projector).toBeDefined();

    repository.decideAuthorityCandidate({
      ...scope,
      strategy: strategy2,
      authorityId: projector!.authorityId,
      type: projector!.type,
      displayName: projector!.displayName,
      description: projector!.description,
      limitations: "",
      decision: "APPROVED",
      ownerAttestation: "Owner confirms this offering.",
      sourceIds: [source.sourceId],
      actor: "owner",
    });

    const otherSiteScope = { organizationId: scope.organizationId, siteId: "site-other", actor: "owner" };
    const otherSiteStrategy = strategy({ revision: 3, productServiceFamilies: ["Projector Enclosure"] });
    const workspace = repository.getSiteAuthorityWorkspace({ ...otherSiteScope, strategy: otherSiteStrategy });
    const projectorCandidate = workspace.candidates.find((item) => item.slug === "projector-enclosure");
    expect(projectorCandidate?.decision).toBe("PENDING");
  });

  test("derives conservative proposed candidates without persisting or auto-approving", async () => {
    const repository = await import("../site-product-authority-repository");
    const workspace = repository.getSiteAuthorityWorkspace({ ...scope, strategy: strategy() });
    expect(workspace.candidates).toHaveLength(3);
    expect(workspace.candidates).toEqual(expect.arrayContaining([expect.objectContaining({ displayName: "Design-Build Fabrication", type: "SERVICE_FAMILY", decision: "PENDING" }), expect.objectContaining({ displayName: "Stainless Countertops", type: "PRODUCT_FAMILY", decision: "PENDING" })]));
    expect(fs.existsSync(path.join(directory, "site-product-authority-repository.json"))).toBe(false);
    expect(repository.listGenerationAuthority(scope)).toEqual([]);
  });

  test("completion invariant requires proposed and approved offerings plus no remaining review", async () => {
    const repository = await import("../site-product-authority-repository");
    expect(repository.evaluateProductAuthorityCompletion({ candidateCount: 0, approvedCount: 0, needReview: 0, protectedBlockers: 0 })).toBe(false);
    expect(repository.evaluateProductAuthorityCompletion({ candidateCount: 1, approvedCount: 0, needReview: 1, protectedBlockers: 0 })).toBe(false);
    expect(repository.evaluateProductAuthorityCompletion({ candidateCount: 1, approvedCount: 1, needReview: 0, protectedBlockers: 1 })).toBe(false);
    expect(repository.evaluateProductAuthorityCompletion({ candidateCount: 1, approvedCount: 1, needReview: 0, protectedBlockers: 0 })).toBe(true);
  });

  test("normalizes safe URLs and blocks local/private literals and DNS resolution", async () => {
    const repository = await import("../site-product-authority-repository");
    expect(repository.normalizeSiteSourceUrl("https://Example.com/path/#fragment")).toBe("https://example.com/path");
    for (const value of ["http://example.com", "file:///tmp/a", "https://localhost/a", "https://127.0.0.1/a", "https://10.0.0.1/a", "https://169.254.1.1/a"]) expect(() => repository.normalizeSiteSourceUrl(value)).toThrow();
    await expect(repository.assertPublicSiteSourceUrl("https://example.com", async () => [{ address: "192.168.1.2", family: 4 }])).rejects.toThrow("SOURCE_URL_PRIVATE");
  });

  test("first-party URL remains owner-approved evidence metadata, never automatic product authority", async () => {
    const repository = await import("../site-product-authority-repository");
    const source = repository.addUrlSource({ ...scope, siteDomain: "rocklinmetal.com", url: "https://rocklinmetal.com/fabrication/", sourceRole: "PRODUCT_SERVICE_AUTHORITY", label: "Fabrication", actor: "owner" });
    expect(source).toMatchObject({ firstParty: true, authority: "EVIDENCE_SOURCE", approvalState: "OWNER_APPROVED", retrievalState: "NOT_RETRIEVED", publishable: false });
    expect(repository.listGenerationAuthority(scope)).toEqual([]);
  });

  test("explicit source proposal creates pending candidates with provenance and never auto-approves", async () => {
    const repository = await import("../site-product-authority-repository");
    const strategyProposal = strategy();
    const source = repository.addUrlSource({ ...scope, siteDomain: "projectorenclosure.com", url: "https://projectorenclosure.com/fan-cooled-projector-enclosures/", sourceRole: "PRODUCT_SERVICE_AUTHORITY", label: "Fan-Cooled Projector Enclosures", actor: "owner" });

    const proposed = repository.proposeAuthorityCandidatesFromSources({ organizationId: scope.organizationId, siteId: scope.siteId, strategy: strategyProposal, actor: "owner" });
    expect(proposed.length).toBeGreaterThan(0);
    expect(proposed[0]).toMatchObject({ decision: "PENDING", sourceIds: expect.arrayContaining([source.sourceId]) });

    const workspace = repository.getSiteAuthorityWorkspace({ organizationId: scope.organizationId, siteId: scope.siteId, strategy: strategyProposal });
    const sourceDerived = workspace.candidates.filter((candidate) => candidate.authorityId.startsWith(`site-authority-source-${scope.siteId}-`));
    expect(sourceDerived.length).toBeGreaterThan(0);
    expect(sourceDerived.every((candidate) => candidate.decision === "PENDING")).toBe(true);
    expect(repository.listGenerationAuthority(scope)).toEqual([]);
  });

  test("source proposals are deduplicated and fail closed when no bounded candidate can be extracted", async () => {
    const repository = await import("../site-product-authority-repository");
    const strategyProposal = strategy();
    const source = repository.addOwnerKnowledgeSource({ ...scope, label: "Authorized offering", statement: "Fan-Cooled Projector Enclosures", sourceRole: "PRODUCT_SERVICE_AUTHORITY", actor: "owner" });

    const first = repository.proposeAuthorityCandidatesFromSources({ organizationId: scope.organizationId, siteId: scope.siteId, strategy: strategyProposal, actor: "owner", sourceIds: [source.sourceId] });
    expect(first.length).toBeGreaterThan(0);
    expect(() => repository.proposeAuthorityCandidatesFromSources({ organizationId: scope.organizationId, siteId: scope.siteId, strategy: strategyProposal, actor: "owner", sourceIds: [source.sourceId] })).toThrow("SOURCE_CANDIDATE_PROPOSAL_INSUFFICIENT_EVIDENCE");

    const noisy = repository.addUrlSource({ ...scope, siteDomain: "projectorenclosure.com", url: "https://projectorenclosure.com/home/", sourceRole: "PRODUCT_SERVICE_AUTHORITY", label: "Home", actor: "owner" });
    expect(() => repository.proposeAuthorityCandidatesFromSources({ organizationId: scope.organizationId, siteId: scope.siteId, strategy: strategyProposal, actor: "owner", sourceIds: [noisy.sourceId] })).toThrow("SOURCE_CANDIDATE_PROPOSAL_INSUFFICIENT_EVIDENCE");
  });

  test("source proposal rejects cross-site and cross-organization source scope", async () => {
    const repository = await import("../site-product-authority-repository");
    const strategyProposal = strategy();
    const sameOrgOtherSite = repository.addOwnerKnowledgeSource({ organizationId: scope.organizationId, siteId: "site-other", label: "Other site", statement: "Outdoor digital displays", sourceRole: "PRODUCT_SERVICE_AUTHORITY", actor: "owner" });
    const otherOrg = repository.addOwnerKnowledgeSource({ organizationId: "other-org", siteId: scope.siteId, label: "Other org", statement: "Outdoor digital displays", sourceRole: "PRODUCT_SERVICE_AUTHORITY", actor: "owner" });

    expect(() => repository.proposeAuthorityCandidatesFromSources({ organizationId: scope.organizationId, siteId: scope.siteId, strategy: strategyProposal, actor: "owner", sourceIds: [sameOrgOtherSite.sourceId] })).toThrow("SOURCE_CANDIDATE_PROPOSAL_INSUFFICIENT_EVIDENCE");
    expect(() => repository.proposeAuthorityCandidatesFromSources({ organizationId: scope.organizationId, siteId: scope.siteId, strategy: strategyProposal, actor: "owner", sourceIds: [otherOrg.sourceId] })).toThrow("SOURCE_CANDIDATE_PROPOSAL_INSUFFICIENT_EVIDENCE");
  });

  test("uploads and owner knowledge preserve provenance while protected owner claims fail closed", async () => {
    const repository = await import("../site-product-authority-repository");
    const upload = repository.addUploadedSource({ ...scope, assetId: "asset-1", originalFileName: "spec.pdf", sha256: "abc", mediaType: "application/pdf", sourceRole: "TECHNICAL_SPECIFICATION", label: "Specification", actor: "owner" });
    expect(upload).toMatchObject({ kind: "UPLOAD", assetId: "asset-1", sha256: "abc", publishable: false, authority: "EVIDENCE_SOURCE" });
    const knowledge = repository.addOwnerKnowledgeSource({ ...scope, label: "Fabrication", statement: "We fabricate custom stainless countertops.", sourceRole: "PRODUCT_SERVICE_AUTHORITY", actor: "owner" });
    expect(knowledge).toMatchObject({ kind: "OWNER_KNOWLEDGE", authority: "OWNER_ATTESTED", publishable: false });
    expect(knowledge.contentFingerprint).toHaveLength(64);
    expect(() => repository.addOwnerKnowledgeSource({ ...scope, label: "Certification", statement: "We are NSF certified.", sourceRole: "TECHNICAL_SPECIFICATION", actor: "owner" })).toThrow("PROTECTED_CLAIM_EVIDENCE_REQUIRED");
  });

  test("upload filename artifacts do not become offering candidates for image or pdf sources", async () => {
    const repository = await import("../site-product-authority-repository");
    const strategyProposal = strategy();
    const uploaded = [
      repository.addUploadedSource({ ...scope, assetId: "asset-jpg", originalFileName: "Shared_image__82_.Jpg", sha256: "hash-jpg", mediaType: "image/jpeg", sourceRole: "PRODUCT_SERVICE_AUTHORITY", label: "", actor: "owner" }),
      repository.addUploadedSource({ ...scope, assetId: "asset-png", originalFileName: "IMG_1001.PNG", sha256: "hash-png", mediaType: "image/png", sourceRole: "PRODUCT_SERVICE_AUTHORITY", label: "", actor: "owner" }),
      repository.addUploadedSource({ ...scope, assetId: "asset-webp", originalFileName: "shop-photo-3.webp", sha256: "hash-webp", mediaType: "image/webp", sourceRole: "PRODUCT_SERVICE_AUTHORITY", label: "", actor: "owner" }),
      repository.addUploadedSource({ ...scope, assetId: "asset-pdf", originalFileName: "countertop-catalog.pdf", sha256: "hash-pdf", mediaType: "application/pdf", sourceRole: "PRODUCT_SERVICE_AUTHORITY", label: "", actor: "owner" }),
    ];

    expect(() => repository.proposeAuthorityCandidatesFromSources({
      organizationId: scope.organizationId,
      siteId: scope.siteId,
      strategy: strategyProposal,
      actor: "owner",
      sourceIds: uploaded.map((source) => source.sourceId),
    })).toThrow("SOURCE_CANDIDATE_PROPOSAL_INSUFFICIENT_EVIDENCE");

    const workspace = repository.getSiteAuthorityWorkspace({ ...scope, strategy: strategyProposal });
    expect(workspace.sources.filter((source) => source.kind === "UPLOAD")).toHaveLength(4);
    expect(workspace.candidates.some((candidate) => /shared image|img 1001|shop photo|catalog/i.test(candidate.displayName))).toBe(false);
    expect(repository.listGenerationAuthority(scope)).toEqual([]);
  });

  test("legitimate owner-provided upload label can still propose pending candidate with provenance", async () => {
    const repository = await import("../site-product-authority-repository");
    const strategyProposal = strategy();
    const imageSource = repository.addUploadedSource({ ...scope, assetId: "asset-2", originalFileName: "Shared_image__82_.Jpg", sha256: "hash-2", mediaType: "image/jpeg", sourceRole: "PRODUCT_SERVICE_AUTHORITY", label: "Homeline Enclosure", actor: "owner" });

    const proposed = repository.proposeAuthorityCandidatesFromSources({
      organizationId: scope.organizationId,
      siteId: scope.siteId,
      strategy: strategyProposal,
      actor: "owner",
      sourceIds: [imageSource.sourceId],
    });

    expect(proposed).toEqual(expect.arrayContaining([
      expect.objectContaining({
        decision: "PENDING",
        displayName: "Homeline Enclosure",
        sourceIds: [imageSource.sourceId],
      }),
    ]));
    expect(proposed.some((candidate) => /shared image/i.test(candidate.displayName))).toBe(false);
    expect(repository.listGenerationAuthority(scope)).toEqual([]);
  });

  test("explicit approval supports editing, reusable source links, isolation, and future grounding", async () => {
    const repository = await import("../site-product-authority-repository");
    const productRepository = await import("../product-repository");
    const existingProductCount = productRepository.listProducts().length;
    const source = repository.addOwnerKnowledgeSource({ ...scope, label: "Fabrication", statement: "We fabricate commercial worktables and countertops.", sourceRole: "PRODUCT_SERVICE_AUTHORITY", actor: "owner" });
    const candidates = repository.getSiteAuthorityWorkspace({ ...scope, strategy: strategy() }).candidates;
    const first = candidates[0]; const second = candidates[1];
    const approved = repository.decideAuthorityCandidate({ ...scope, strategy: strategy(), authorityId: first.authorityId, type: "PRODUCT", displayName: "Custom Stainless Countertops", description: "Custom fabricated countertop solutions.", limitations: "", decision: "APPROVED", ownerAttestation: "Owner confirms this offering.", sourceIds: [source.sourceId], actor: "owner" });
    repository.decideAuthorityCandidate({ ...scope, strategy: strategy(), authorityId: second.authorityId, type: "SERVICE", displayName: second.displayName, description: "Design-build fabrication service.", limitations: "Project dependent", decision: "QUALIFIED", ownerAttestation: "Owner confirms with limitations.", sourceIds: [source.sourceId], actor: "owner" });
    expect(approved).toMatchObject({ type: "PRODUCT", displayName: "Custom Stainless Countertops", authorityBasis: "OWNER_ATTESTED_AND_EVIDENCE", sourceIds: [source.sourceId] });
    expect(repository.listGenerationAuthority(scope)).toHaveLength(2);
    expect(productRepository.listProducts()).toHaveLength(existingProductCount);
    for (const name of ["glw-campaign-repository.json", "wordpress-credential-store.json"]) expect(fs.existsSync(path.join(directory, name))).toBe(false);
    const historicalStrategy = strategy(); expect(historicalStrategy.productServiceFamilies).toEqual(["Stainless Countertops", "Stainless Countertop", "Design-Build Fabrication", "Commercial Worktables And Prep Tables"]);
    expect(() => repository.decideAuthorityCandidate({ ...scope, strategy: strategy(), authorityId: candidates[2].authorityId, type: "PRODUCT_FAMILY", displayName: candidates[2].displayName, description: "Test", limitations: "", decision: "APPROVED", ownerAttestation: "Owner confirms.", sourceIds: ["missing"], actor: "owner" })).toThrow("SOURCE_ORGANIZATION_MISMATCH");
    const otherSiteSource = repository.addOwnerKnowledgeSource({ organizationId: scope.organizationId, siteId: "other-site", label: "Other", statement: "Other site fact.", sourceRole: "BUSINESS_FACTS", actor: "owner" });
    expect(() => repository.decideAuthorityCandidate({ ...scope, strategy: strategy(), authorityId: candidates[2].authorityId, type: "PRODUCT_FAMILY", displayName: candidates[2].displayName, description: "Test", limitations: "", decision: "APPROVED", ownerAttestation: "Owner confirms.", sourceIds: [otherSiteSource.sourceId], actor: "owner" })).toThrow("SOURCE_SITE_MISMATCH");
  });

  test("creative references cannot establish factual product authority and protected facts require evidence", async () => {
    const repository = await import("../site-product-authority-repository");
    const creative = repository.addUrlSource({ ...scope, siteDomain: "rocklinmetal.com", url: "https://competitor.example/reference", sourceRole: "CREATIVE_REFERENCE", label: "Inspiration", actor: "owner" });
    const candidate = repository.getSiteAuthorityWorkspace({ ...scope, strategy: strategy() }).candidates[0];
    const ordinary = repository.decideAuthorityCandidate({ ...scope, strategy: strategy(), authorityId: candidate.authorityId, type: "PRODUCT_FAMILY", displayName: candidate.displayName, description: "Ordinary countertop offering", limitations: "", decision: "APPROVED", ownerAttestation: "Owner confirms.", sourceIds: [creative.sourceId], actor: "owner" });
    expect(ordinary.authorityBasis).toBe("OWNER_ATTESTED");
    expect(() => repository.decideAuthorityCandidate({ ...scope, strategy: strategy(), authorityId: candidate.authorityId, type: "PRODUCT_FAMILY", displayName: "NSF Certified Countertops", description: "NSF compliant", limitations: "", decision: "APPROVED", ownerAttestation: "Owner confirms.", sourceIds: [creative.sourceId], actor: "owner" })).toThrow("PROTECTED_CLAIM_EVIDENCE_REQUIRED");
    const specification = repository.addUploadedSource({ ...scope, assetId: "certificate", originalFileName: "nsf.pdf", sha256: "certificate-hash", mediaType: "application/pdf", sourceRole: "TECHNICAL_SPECIFICATION", label: "NSF certificate", actor: "owner" });
    const verified = repository.decideAuthorityCandidate({ ...scope, strategy: strategy(), authorityId: candidate.authorityId, type: "PRODUCT_FAMILY", displayName: "NSF Certified Countertops", description: "NSF compliant", limitations: "", decision: "APPROVED", ownerAttestation: "Owner confirms.", sourceIds: [specification.sourceId], actor: "owner" });
    expect(verified.authorityBasis).toBe("OWNER_ATTESTED_AND_EVIDENCE");
    expect(repository.listGenerationAuthority(scope)).toEqual([expect.objectContaining({ authorityId: candidate.authorityId, sourceIds: [specification.sourceId] })]);
    expect(creative.publishable).toBe(false);
  });
});