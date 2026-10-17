import { getCapabilityEvidencePolicy, type CapabilityEvidenceOption, type SiteIntelligenceWorkspace, type SiteOpportunity } from "../site-intelligence";
import {
  CAPABILITY_RELEVANCE_TYPES,
  canonicalCapabilityState,
  evidenceNeedsClarification,
  describeCapabilitySaveReadiness,
  getOwnerCapabilityPreview,
  hasSpecificCapabilityProof,
  inferEvidenceRelevance,
  OWNER_CAPABILITY_CHOICES,
  OWNER_EVIDENCE_CHOICES,
  ownerCapabilityChoice,
  validateCapabilitySaveResponse,
} from "../site-capability-owner-ux";

function opportunity(name = "Commercial worktables and prep tables"): SiteOpportunity {
  return { opportunityId: "owner-preview", name, category: "commercial fabrication", buyer: "Commercial buyers", problemUseCase: "Fabricated worktables", commercialValue: "HIGH", demandSignal: "Observed", competitionLevel: "MODERATE", organizationFit: "HIGH", evidenceStrength: "MODERATE", confidence: 0.8, geographicScope: "regional", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "candidate", rationale: "Ordinary fabrication capability.", competitorEntities: [], evidenceIds: [], capabilityState: "VERIFIED", capabilityEvidenceIds: [], capabilityNotes: null, recommendation: "Review", ownerDecision: "APPROVED", decidedBy: "owner", decidedAt: "2026-09-11T00:00:00.000Z" };
}

function evidence(label: string, notes: string | null = null): CapabilityEvidenceOption {
  return {
    referenceId: `creative:${label}`,
    sourceType: "OWNER_UPLOAD",
    label,
    notes,
    provenance: "OWNER_UPLOAD: owner-file",
    classification: "OWNER_SUPPLIED_REFERENCE",
    createdAt: "2026-09-11T00:00:00.000Z",
  };
}

function workspace(opportunities: SiteOpportunity[]): SiteIntelligenceWorkspace {
  return {
    workspaceId: "workspace-1",
    organizationId: "org",
    siteId: "site",
    internalOrganizationIdentity: "org",
    publicBrandIdentity: "Brand",
    revision: 1,
    intelligenceState: "INTELLIGENCE_READY_FOR_REVIEW",
    strategyState: "STRATEGY_NOT_STARTED",
    creativeState: "CREATIVE_INPUTS_COLLECTING",
    providerReference: null,
    researchStartedAt: null,
    researchExecutions: [],
    evidence: [],
    opportunities,
    strategyRevisions: [],
    creativeInputs: [],
    creativeRevisions: [],
    audit: [],
    createdAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
  };
}

describe("owner capability UX mapping", () => {
  test("plain owner choices map only to canonical capability states", () => {
    expect(Object.fromEntries(OWNER_CAPABILITY_CHOICES.map((item) => [item.value, canonicalCapabilityState(item.value)]))).toEqual({
      CURRENT: "VERIFIED",
      LIMITED: "QUALIFIED",
      FUTURE: "FUTURE_CAPABILITY",
      NO: "REJECTED",
    });
    expect(ownerCapabilityChoice("OWNER_VALIDATION_REQUIRED")).toBeNull();
  });

  test.each([
    ["completed-project.jpg", "PROJECT_EXAMPLE"],
    ["product-catalog.pdf", "PRODUCT_EXAMPLE"],
    ["shop-drawing.pdf", "FABRICATION_EXAMPLE"],
    ["compliance-certificate.pdf", "SPECIFICATION_OR_COMPLIANCE_EVIDENCE"],
    ["service-area-map.pdf", "GEOGRAPHIC_SERVICE_EVIDENCE"],
  ] as const)("conservatively infers %s as %s", (label, expected) => {
    expect(inferEvidenceRelevance(evidence(label))).toBe(expected);
  });

  test("unknown evidence stays general and requires owner clarification", () => {
    const relevance = inferEvidenceRelevance(evidence("reference.jpg"));
    expect(relevance).toBe("GENERAL_REFERENCE");
    expect(evidenceNeedsClarification(relevance)).toBe(true);
  });

  test("missing or general relevance cannot satisfy the client proof precheck", () => {
    expect(hasSpecificCapabilityProof(["missing"], {})).toBe(false);
    expect(hasSpecificCapabilityProof(["general"], { general: "GENERAL_REFERENCE" })).toBe(false);
    expect(hasSpecificCapabilityProof(["project"], { project: "PROJECT_EXAMPLE" })).toBe(true);
  });

  test("pending owner confirmation immediately changes ordinary capability preview and save eligibility", () => {
    const pending = { opportunity: opportunity(), choice: "CURRENT" as const, selectedEvidence: [], evidenceRelevance: {}, limitations: "" };
    expect(getOwnerCapabilityPreview({ ...pending, ownerConfirmed: false })).toMatchObject({ label: "REVIEW REQUIRED", ownerConfirmation: "Needed", supportingProof: "Not added", canSubmit: false });
    expect(getOwnerCapabilityPreview({ ...pending, ownerConfirmed: true })).toMatchObject({ label: "OWNER CONFIRMED", ownerConfirmation: "Confirmed", supportingProof: "Not added", canSubmit: true });
  });

  test("save readiness explains missing attestation and qualified limitations", () => {
    const preview = getOwnerCapabilityPreview({
      opportunity: opportunity(),
      choice: "LIMITED",
      ownerConfirmed: false,
      selectedEvidence: [],
      evidenceRelevance: {},
      limitations: "",
    });
    const readiness = describeCapabilitySaveReadiness({
      choice: "LIMITED",
      ownerConfirmed: false,
      limitations: "",
      preview,
      busy: false,
      saving: false,
    });
    expect(readiness.canSave).toBe(false);
    expect(readiness.blockedReasons).toEqual(expect.arrayContaining([
      "Confirm owner capability attestation before saving.",
      "Enter the capability limitations before saving a qualified capability.",
    ]));
  });

  test("save readiness warns when protected proof is still required", () => {
    const preview = getOwnerCapabilityPreview({
      opportunity: opportunity("Nationwide service coverage"),
      choice: "CURRENT",
      ownerConfirmed: true,
      selectedEvidence: [],
      evidenceRelevance: {},
      limitations: "",
    });
    const readiness = describeCapabilitySaveReadiness({
      choice: "CURRENT",
      ownerConfirmed: true,
      limitations: "",
      preview,
      busy: false,
      saving: false,
    });
    expect(readiness.canSave).toBe(true);
    expect(readiness.advisory).toMatch(/Independent proof is still required/);
  });

  test("save-response validation targets the displayed opportunity ID", () => {
    const current = opportunity("Fast indexing and content freshness notifications");
    current.opportunityId = "O6";
    current.capabilityState = "FUTURE_CAPABILITY";
    current.capabilityAuthorityRevisions = [{
      organizationId: "org",
      siteId: "site",
      opportunityId: "O6",
      decision: "FUTURE_CAPABILITY",
      evidenceIds: [],
      evidenceRelevance: [],
      attestation: "Owner confirms this is not current capability.",
      qualificationNotes: null,
      decidedBy: "owner",
      decidedAt: "2026-09-11T00:00:00.000Z",
      revision: 1,
    }];
    const staleOther = opportunity("SaaS comparison-page engine");
    staleOther.opportunityId = "O1";
    staleOther.capabilityState = "FUTURE_CAPABILITY";
    staleOther.capabilityAuthorityRevisions = [{
      ...current.capabilityAuthorityRevisions[0],
      opportunityId: "O1",
      decision: "FUTURE_CAPABILITY",
    }];

    const ok = validateCapabilitySaveResponse({
      workspace: workspace([staleOther, current]),
      targetOpportunityId: "O6",
      expectedState: "FUTURE_CAPABILITY",
    });
    expect(ok).toMatchObject({ ok: true, reason: null });
    expect(ok.savedOpportunity?.opportunityId).toBe("O6");
  });

  test("save-response validation rejects wrong opportunity and accepts authoritative revision state", () => {
    const o5 = opportunity("Technical SEO audit and remediation workflow");
    o5.opportunityId = "O5";
    o5.capabilityState = "OWNER_VALIDATION_REQUIRED";
    o5.capabilityAuthorityRevisions = [{
      organizationId: "org",
      siteId: "site",
      opportunityId: "O5",
      decision: "VERIFIED",
      evidenceIds: [],
      evidenceRelevance: [],
      attestation: "Owner confirms current capability.",
      authorityBasis: "OWNER_ATTESTATION",
      qualificationNotes: null,
      decidedBy: "owner",
      decidedAt: "2026-09-11T00:00:00.000Z",
      revision: 1,
    }];

    const missing = validateCapabilitySaveResponse({
      workspace: workspace([o5]),
      targetOpportunityId: "O6",
      expectedState: "FUTURE_CAPABILITY",
    });
    expect(missing).toMatchObject({ ok: false, reason: "OPPORTUNITY_NOT_FOUND" });

    const authoritative = validateCapabilitySaveResponse({
      workspace: workspace([o5]),
      targetOpportunityId: "O5",
      expectedState: "VERIFIED",
    });
    expect(authoritative).toMatchObject({ ok: true, reason: null });
  });

  test("protected certification preview requires policy-matched proof after confirmation", () => {
    const pending = { opportunity: opportunity("NSF certified worktables"), choice: "CURRENT" as const, ownerConfirmed: true, limitations: "" };
    expect(getOwnerCapabilityPreview({ ...pending, selectedEvidence: [], evidenceRelevance: {} })).toMatchObject({ label: "PROOF REQUIRED", ownerConfirmation: "Confirmed", supportingProof: "Needed", canSubmit: true, proofRequired: true });
    expect(getOwnerCapabilityPreview({ ...pending, selectedEvidence: ["general"], evidenceRelevance: { general: "GENERAL_REFERENCE" } })).toMatchObject({ label: "PROOF REQUIRED", canSubmit: true });
    expect(getOwnerCapabilityPreview({ ...pending, selectedEvidence: ["certificate"], evidenceRelevance: { certificate: "SPECIFICATION_OR_COMPLIANCE_EVIDENCE" } })).toMatchObject({ label: "VERIFIED", supportingProof: "Verified", canSubmit: true });
  });

  test.each([
    ["UL listed equipment", "COMPLIANCE_OR_CERTIFICATION"],
    ["NSF certified worktables", "COMPLIANCE_OR_CERTIFICATION"],
    ["GMP compliant fabrication", "COMPLIANCE_OR_CERTIFICATION"],
    ["Nationwide service coverage", "GEOGRAPHIC_SERVICE"],
    ["Authorized dealer authority", "CHANNEL_AUTHORITY"],
  ] as const)("classifies protected claim %s as %s", (name, protectedClaimClass) => {
    expect(getCapabilityEvidencePolicy(opportunity(name))).toMatchObject({ requirement: "INDEPENDENT_EVIDENCE_REQUIRED", protectedClaimClass });
  });

  test("owner-friendly evidence choices retain canonical relevance values", () => {
    expect(OWNER_EVIDENCE_CHOICES).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Something we made", relevanceType: "FABRICATION_EXAMPLE" }),
      expect.objectContaining({ label: "General reference", relevanceType: "GENERAL_REFERENCE" }),
    ]));
    expect(new Set(CAPABILITY_RELEVANCE_TYPES)).toEqual(new Set([
      "DIRECT_CAPABILITY_PROOF",
      "PROJECT_EXAMPLE",
      "PRODUCT_EXAMPLE",
      "FABRICATION_EXAMPLE",
      "SERVICE_SCOPE",
      "DELIVERY_SCOPE",
      "CHANNEL_EVIDENCE",
      "GEOGRAPHIC_SERVICE_EVIDENCE",
      "SPECIFICATION_OR_COMPLIANCE_EVIDENCE",
      "OWNER_ATTESTATION_SUPPORT",
      "GENERAL_REFERENCE",
    ]));
  });
});