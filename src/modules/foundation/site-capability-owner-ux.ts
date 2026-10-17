import type {
  CapabilityEvidenceOption,
  CapabilityEvidenceRelevanceType,
  CapabilityEvidenceState,
  SiteIntelligenceWorkspace,
  SiteOpportunity,
} from "./site-intelligence";
import { getCapabilityAuthorityAssurance, getCapabilityEvidencePolicy, isEvidenceSufficientForCapabilityPolicy, resolveAuthoritativeCapabilityState } from "./site-intelligence";

export type OwnerCapabilityChoice = "CURRENT" | "LIMITED" | "FUTURE" | "NO";

export const OWNER_CAPABILITY_CHOICES: ReadonlyArray<{
  value: OwnerCapabilityChoice;
  label: string;
  state: CapabilityEvidenceState;
}> = [
  { value: "CURRENT", label: "YES - CURRENT CAPABILITY", state: "VERIFIED" },
  { value: "LIMITED", label: "YES - WITH LIMITATIONS", state: "QUALIFIED" },
  { value: "FUTURE", label: "NOT YET", state: "FUTURE_CAPABILITY" },
  { value: "NO", label: "NO", state: "REJECTED" },
];

export const OWNER_EVIDENCE_CHOICES: ReadonlyArray<{
  label: string;
  relevanceType: CapabilityEvidenceRelevanceType;
}> = [
  { label: "Direct proof of this capability", relevanceType: "DIRECT_CAPABILITY_PROOF" },
  { label: "Something we made", relevanceType: "FABRICATION_EXAMPLE" },
  { label: "A completed project", relevanceType: "PROJECT_EXAMPLE" },
  { label: "A product we offer", relevanceType: "PRODUCT_EXAMPLE" },
  { label: "Our service capability", relevanceType: "SERVICE_SCOPE" },
  { label: "Spec / compliance proof", relevanceType: "SPECIFICATION_OR_COMPLIANCE_EVIDENCE" },
  { label: "Delivery capability", relevanceType: "DELIVERY_SCOPE" },
  { label: "Service-area proof", relevanceType: "GEOGRAPHIC_SERVICE_EVIDENCE" },
  { label: "Sales / dealer / channel proof", relevanceType: "CHANNEL_EVIDENCE" },
  { label: "Owner supporting material", relevanceType: "OWNER_ATTESTATION_SUPPORT" },
  { label: "General reference", relevanceType: "GENERAL_REFERENCE" },
];

export const CAPABILITY_RELEVANCE_TYPES: readonly CapabilityEvidenceRelevanceType[] = [
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
];

export function canonicalCapabilityState(choice: OwnerCapabilityChoice): CapabilityEvidenceState {
  return OWNER_CAPABILITY_CHOICES.find((item) => item.value === choice)?.state ?? "OWNER_VALIDATION_REQUIRED";
}

export function ownerCapabilityChoice(state: CapabilityEvidenceState): OwnerCapabilityChoice | null {
  return OWNER_CAPABILITY_CHOICES.find((item) => item.state === state)?.value ?? null;
}

export function inferEvidenceRelevance(option: CapabilityEvidenceOption): CapabilityEvidenceRelevanceType {
  const context = `${option.label} ${option.notes ?? ""} ${option.provenance}`.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (/specification|compliance|certificat|code report|test report/.test(context)) return "SPECIFICATION_OR_COMPLIANCE_EVIDENCE";
  if (/service area|coverage area|geographic|territor/.test(context)) return "GEOGRAPHIC_SERVICE_EVIDENCE";
  if (/deliver|installation|fulfillment|shipping/.test(context)) return "DELIVERY_SCOPE";
  if (/dealer|distributor|channel|reseller/.test(context)) return "CHANNEL_EVIDENCE";
  if (/completed project|case study|project photo|installed/.test(context)) return "PROJECT_EXAMPLE";
  if (/product|catalog|offering|sku/.test(context)) return "PRODUCT_EXAMPLE";
  if (/fabricat|something we made|shop drawing|as-built/.test(context)) return "FABRICATION_EXAMPLE";
  if (/service capability|scope of work|statement of work/.test(context)) return "SERVICE_SCOPE";
  if (/direct proof|capability proof/.test(context)) return "DIRECT_CAPABILITY_PROOF";
  return "GENERAL_REFERENCE";
}

export function evidenceNeedsClarification(relevanceType: CapabilityEvidenceRelevanceType): boolean {
  return relevanceType === "GENERAL_REFERENCE";
}

export function hasSpecificCapabilityProof(
  selectedEvidence: readonly string[],
  evidenceRelevance: Readonly<Record<string, CapabilityEvidenceRelevanceType>>,
): boolean {
  return selectedEvidence.some((evidenceId) => {
    const relevance = evidenceRelevance[evidenceId];
    return relevance !== undefined && relevance !== "GENERAL_REFERENCE";
  });
}

export type OwnerCapabilityPreview = {
  label: "REVIEW REQUIRED" | "OWNER CONFIRMED" | "VERIFIED" | "PROOF REQUIRED" | "QUALIFIED" | "NOT A CURRENT CAPABILITY" | "NOT OFFERED" | "NEEDS OWNER REVIEW";
  ownerConfirmation: "Confirmed" | "Needed" | "Not required";
  supportingProof: "Verified" | "Needed" | "Not added" | "Not required";
  canSubmit: boolean;
  proofRequired: boolean;
  proofReason: string | null;
};

export type CapabilitySaveReadiness = {
  canSave: boolean;
  blockedReasons: string[];
  advisory: string | null;
};

export type CapabilitySaveResponseValidation = {
  ok: boolean;
  savedOpportunity: SiteOpportunity | null;
  reason: "OPPORTUNITY_NOT_FOUND" | "STATE_MISMATCH" | null;
};

export function validateCapabilitySaveResponse(input: {
  workspace: SiteIntelligenceWorkspace;
  targetOpportunityId: string;
  expectedState: CapabilityEvidenceState;
}): CapabilitySaveResponseValidation {
  const savedOpportunity = [...input.workspace.opportunities]
    .reverse()
    .find((candidate) => candidate.opportunityId === input.targetOpportunityId) ?? null;
  if (!savedOpportunity) {
    return { ok: false, savedOpportunity: null, reason: "OPPORTUNITY_NOT_FOUND" };
  }
  if (resolveAuthoritativeCapabilityState(savedOpportunity) !== input.expectedState) {
    return { ok: false, savedOpportunity, reason: "STATE_MISMATCH" };
  }
  return { ok: true, savedOpportunity, reason: null };
}

export function getOwnerCapabilityPreview(input: {
  opportunity: SiteOpportunity;
  choice: OwnerCapabilityChoice | null;
  ownerConfirmed: boolean;
  selectedEvidence: readonly string[];
  evidenceRelevance: Readonly<Record<string, CapabilityEvidenceRelevanceType>>;
  limitations: string;
}): OwnerCapabilityPreview {
  if (!input.choice) {
    const assurance = getCapabilityAuthorityAssurance(input.opportunity);
    return {
      label: assurance === "OWNER_ATTESTED" ? "OWNER CONFIRMED" : assurance === "EVIDENCE_VERIFIED" ? "VERIFIED" : assurance === "PROOF_REQUIRED" ? "PROOF REQUIRED" : assurance === "NOT_CURRENT" ? "NEEDS OWNER REVIEW" : "REVIEW REQUIRED",
      ownerConfirmation: assurance === "OWNER_ATTESTED" || assurance === "EVIDENCE_VERIFIED" || assurance === "PROOF_REQUIRED" ? "Confirmed" : "Needed",
      supportingProof: assurance === "EVIDENCE_VERIFIED" ? "Verified" : assurance === "PROOF_REQUIRED" ? "Needed" : assurance === "OWNER_ATTESTED" ? "Not added" : "Not required",
      canSubmit: false,
      proofRequired: assurance === "PROOF_REQUIRED",
      proofReason: assurance === "PROOF_REQUIRED" ? getCapabilityEvidencePolicy(input.opportunity).reason : null,
    };
  }

  const state = canonicalCapabilityState(input.choice);
  const currentDecision = state === "VERIFIED" || state === "QUALIFIED";
  const policy = getCapabilityEvidencePolicy(input.opportunity);
  const specificProof = input.selectedEvidence.some((evidenceId) => {
    const relevance = input.evidenceRelevance[evidenceId];
    return relevance !== undefined && isEvidenceSufficientForCapabilityPolicy(policy, relevance);
  });
  const proofRequired = currentDecision && policy.requirement === "INDEPENDENT_EVIDENCE_REQUIRED";
  const confirmationRequired = currentDecision || state === "FUTURE_CAPABILITY";
  const canSubmit = (!confirmationRequired || input.ownerConfirmed)
    && (state !== "QUALIFIED" || Boolean(input.limitations.trim()));
  const label = state === "FUTURE_CAPABILITY"
    ? "NOT A CURRENT CAPABILITY"
    : state === "REJECTED"
      ? "NOT OFFERED"
      : proofRequired && !specificProof
        ? "PROOF REQUIRED"
        : input.ownerConfirmed
          ? specificProof ? state === "QUALIFIED" ? "QUALIFIED" : "VERIFIED" : state === "QUALIFIED" ? "QUALIFIED" : "OWNER CONFIRMED"
          : "REVIEW REQUIRED";

  return {
    label,
    ownerConfirmation: confirmationRequired ? input.ownerConfirmed ? "Confirmed" : "Needed" : "Not required",
    supportingProof: specificProof ? "Verified" : proofRequired ? "Needed" : currentDecision ? "Not added" : "Not required",
    canSubmit,
    proofRequired,
    proofReason: proofRequired ? policy.reason : null,
  };
}

export function describeCapabilitySaveReadiness(input: {
  choice: OwnerCapabilityChoice | null;
  ownerConfirmed: boolean;
  limitations: string;
  preview: OwnerCapabilityPreview;
  busy: boolean;
  saving: boolean;
}): CapabilitySaveReadiness {
  const blockedReasons: string[] = [];
  if (input.saving) blockedReasons.push("Saving is already in progress for this capability review.");
  if (input.busy) blockedReasons.push("Wait for the current workspace request to finish.");
  if (!input.choice) blockedReasons.push("Choose how this opportunity maps to your current capability.");
  if (input.choice) {
    const state = canonicalCapabilityState(input.choice);
    const confirmationRequired = state === "VERIFIED" || state === "QUALIFIED" || state === "FUTURE_CAPABILITY";
    if (confirmationRequired && !input.ownerConfirmed) {
      blockedReasons.push(state === "FUTURE_CAPABILITY"
        ? "Confirm that this is not a current capability."
        : "Confirm owner capability attestation before saving.");
    }
    if (state === "QUALIFIED" && !input.limitations.trim()) {
      blockedReasons.push("Enter the capability limitations before saving a qualified capability.");
    }
  }

  const advisory = input.preview.proofRequired && input.preview.supportingProof === "Needed"
    ? "Independent proof is still required for this protected claim. Saving owner attestation alone will not complete this review."
    : null;

  return {
    canSave: input.preview.canSubmit && blockedReasons.length === 0,
    blockedReasons,
    advisory,
  };
}