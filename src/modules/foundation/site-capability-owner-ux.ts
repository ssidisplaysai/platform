import type {
  CapabilityEvidenceOption,
  CapabilityEvidenceRelevanceType,
  CapabilityEvidenceState,
} from "./site-intelligence";

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