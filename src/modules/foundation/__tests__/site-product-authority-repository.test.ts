import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SiteStrategyProposal } from "../site-intelligence";

const scope = { organizationId: "rj-metal", siteId: "site-rj", actor: "owner" };
function strategy(): SiteStrategyProposal { return { revision: 8, positioning: "Position", primaryAudience: "Commercial buyers", secondaryAudiences: [], valueProposition: "Value", majorVerticals: [], productServiceFamilies: ["Stainless Countertops", "Stainless Countertop", "Design-Build Fabrication", "Commercial Worktables And Prep Tables"], informationArchitecture: [], proposedSitemap: [], homepageGoals: [], conversionPaths: [], ctaHierarchy: [], trustProofRequirements: [], geographicStrategy: "Regional", proposedProductAuthority: [], status: "APPROVED", reason: "Approved", createdBy: "owner", createdAt: "2026-09-11T00:00:00.000Z", decidedBy: "owner", decidedAt: "2026-09-11T00:01:00.000Z" }; }

describe("site product/service authority repository", () => {
  const old = process.env.GCP_FOUNDATION_PERSISTENCE_DIR; let directory: string;
  beforeEach(() => { jest.resetModules(); directory = fs.mkdtempSync(path.join(os.tmpdir(), "site-product-authority-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = old; fs.rmSync(directory, { recursive: true, force: true }); });

  test("derives conservative proposed candidates without persisting or auto-approving", async () => {
    const repository = await import("../site-product-authority-repository");
    const workspace = repository.getSiteAuthorityWorkspace({ ...scope, strategy: strategy() });
    expect(workspace.candidates).toHaveLength(3);
    expect(workspace.candidates).toEqual(expect.arrayContaining([expect.objectContaining({ displayName: "Design-Build Fabrication", type: "SERVICE_FAMILY", decision: "PENDING" }), expect.objectContaining({ displayName: "Stainless Countertops", type: "PRODUCT_FAMILY", decision: "PENDING" })]));
    expect(fs.existsSync(path.join(directory, "site-product-authority-repository.json"))).toBe(false);
    expect(repository.listGenerationAuthority(scope)).toEqual([]);
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

  test("uploads and owner knowledge preserve provenance while protected owner claims fail closed", async () => {
    const repository = await import("../site-product-authority-repository");
    const upload = repository.addUploadedSource({ ...scope, assetId: "asset-1", originalFileName: "spec.pdf", sha256: "abc", mediaType: "application/pdf", sourceRole: "TECHNICAL_SPECIFICATION", label: "Specification", actor: "owner" });
    expect(upload).toMatchObject({ kind: "UPLOAD", assetId: "asset-1", sha256: "abc", publishable: false, authority: "EVIDENCE_SOURCE" });
    const knowledge = repository.addOwnerKnowledgeSource({ ...scope, label: "Fabrication", statement: "We fabricate custom stainless countertops.", sourceRole: "PRODUCT_SERVICE_AUTHORITY", actor: "owner" });
    expect(knowledge).toMatchObject({ kind: "OWNER_KNOWLEDGE", authority: "OWNER_ATTESTED", publishable: false });
    expect(knowledge.contentFingerprint).toHaveLength(64);
    expect(() => repository.addOwnerKnowledgeSource({ ...scope, label: "Certification", statement: "We are NSF certified.", sourceRole: "TECHNICAL_SPECIFICATION", actor: "owner" })).toThrow("PROTECTED_CLAIM_EVIDENCE_REQUIRED");
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