import { getCapabilityEvidencePolicy, type CapabilityEvidenceOption, type SiteOpportunity } from "../site-intelligence";
import {
  CAPABILITY_RELEVANCE_TYPES,
  canonicalCapabilityState,
  evidenceNeedsClarification,
  getOwnerCapabilityPreview,
  hasSpecificCapabilityProof,
  inferEvidenceRelevance,
  OWNER_CAPABILITY_CHOICES,
  OWNER_EVIDENCE_CHOICES,
  ownerCapabilityChoice,
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