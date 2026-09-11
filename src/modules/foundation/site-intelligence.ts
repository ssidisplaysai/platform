export type SiteIntelligenceState =
  | "INTELLIGENCE_NOT_STARTED"
  | "INTELLIGENCE_RESEARCHING"
  | "INTELLIGENCE_READY_FOR_REVIEW"
  | "INTELLIGENCE_APPROVED";

export type SiteStrategyState =
  | "STRATEGY_NOT_STARTED"
  | "STRATEGY_READY_FOR_REVIEW"
  | "STRATEGY_APPROVED"
  | "STRATEGY_REJECTED";

export type CreativeDirectionState =
  | "CREATIVE_NOT_STARTED"
  | "CREATIVE_INPUTS_COLLECTING"
  | "CREATIVE_READY_FOR_REVIEW"
  | "CREATIVE_APPROVED"
  | "CREATIVE_REJECTED";

export type EvidenceAuthority = "OBSERVATION" | "INFERENCE" | "OWNER_SUPPLIED_AUTHORITY";
export type EvidenceStrength = "WEAK" | "MODERATE" | "STRONG";
export type OpportunityDecision = "PENDING" | "APPROVED" | "RESEARCH_MORE" | "HOLD" | "REJECTED";
export type CapabilityEvidenceState =
  | "INSUFFICIENT"
  | "OWNER_VALIDATION_REQUIRED"
  | "VERIFIED"
  | "QUALIFIED"
  | "REJECTED"
  | "FUTURE_CAPABILITY";
export type CapabilityEvidenceRelevanceType =
  | "DIRECT_CAPABILITY_PROOF"
  | "PROJECT_EXAMPLE"
  | "PRODUCT_EXAMPLE"
  | "FABRICATION_EXAMPLE"
  | "SERVICE_SCOPE"
  | "DELIVERY_SCOPE"
  | "CHANNEL_EVIDENCE"
  | "GEOGRAPHIC_SERVICE_EVIDENCE"
  | "SPECIFICATION_OR_COMPLIANCE_EVIDENCE"
  | "OWNER_ATTESTATION_SUPPORT"
  | "GENERAL_REFERENCE";
export type CapabilityEvidenceRelevance = {
  evidenceId: string;
  opportunityId: string;
  relevanceType: CapabilityEvidenceRelevanceType;
  ownerConfirmedRelevant: boolean;
  linkedBy: string;
  linkedAt: string;
};
export type CapabilityAuthorityBasis = "OWNER_ATTESTATION" | "OWNER_ATTESTATION_AND_EVIDENCE";
export type CapabilityAuthorityDecision = {
  organizationId: string;
  siteId: string;
  opportunityId: string;
  decision: CapabilityEvidenceState;
  evidenceIds: string[];
  evidenceRelevance: CapabilityEvidenceRelevance[];
  attestation: string;
  authorityBasis?: CapabilityAuthorityBasis;
  qualificationNotes: string | null;
  decidedBy: string;
  decidedAt: string;
  revision: number;
};
export type CapabilityAuthorityStatus = "CURRENT" | "AUTHORITY_REVIEW_REQUIRED" | "NOT_CURRENT";
export type CapabilityAuthorityAssurance = "OWNER_ATTESTED" | "EVIDENCE_VERIFIED" | "PROOF_REQUIRED" | "REVIEW_REQUIRED" | "NOT_CURRENT";
export type CapabilityEvidencePolicy = {
  requirement: "OWNER_ATTESTATION_ALLOWED" | "INDEPENDENT_EVIDENCE_REQUIRED";
  protectedClaimClass: "COMPLIANCE_OR_CERTIFICATION" | "GEOGRAPHIC_SERVICE" | "CHANNEL_AUTHORITY" | null;
  reason: string | null;
};
export type SiteAssetClassification =
  | "OWNER_APPROVED_PUBLISHABLE"
  | "OWNER_SUPPLIED_REFERENCE"
  | "GENESIS_GENERATED_CANDIDATE"
  | "EXTERNAL_INSPIRATION_ONLY"
  | "COMPETITOR_REFERENCE_ONLY"
  | "UNVERIFIED"
  | "REJECTED";

export type SiteIntelligenceEvidence = {
  evidenceId: string;
  sourceReference: string;
  sourceType: "WEB" | "OWNER_URL" | "OWNER_DOCUMENT" | "OWNER_IMAGE" | "CONNECTED_SOURCE" | "PROVIDER_OUTPUT";
  observedClaim: string;
  retrievedAt: string;
  entity: string | null;
  confidence: number;
  strength: EvidenceStrength;
  authority: EvidenceAuthority;
};

export type SiteOpportunity = {
  opportunityId: string;
  name: string;
  category: string;
  buyer: string;
  problemUseCase: string;
  commercialValue: "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";
  demandSignal: string;
  competitionLevel: "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";
  organizationFit: "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";
  evidenceStrength: EvidenceStrength;
  confidence: number;
  geographicScope: string;
  nationalRolloutPotential: boolean;
  recurringReplacementPotential: boolean;
  seoContentOpportunity: string;
  rationale: string;
  competitorEntities: string[];
  evidenceIds: string[];
  capabilityState: CapabilityEvidenceState;
  capabilityEvidenceIds: string[];
  capabilityNotes: string | null;
  capabilityAuthorityRevisions?: CapabilityAuthorityDecision[];
  recommendation: string;
  ownerDecision: OpportunityDecision;
  decidedBy: string | null;
  decidedAt: string | null;
};

export type SiteStrategyProposal = {
  revision: number;
  positioning: string;
  primaryAudience: string;
  secondaryAudiences: string[];
  valueProposition: string;
  majorVerticals: string[];
  productServiceFamilies: string[];
  informationArchitecture: string[];
  proposedSitemap: string[];
  homepageGoals: string[];
  conversionPaths: string[];
  ctaHierarchy: string[];
  trustProofRequirements: string[];
  geographicStrategy: string;
  proposedProductAuthority: string[];
  status: "PROPOSED" | "APPROVED" | "REVISION_REQUESTED" | "REJECTED";
  reason: string;
  createdBy: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  synthesisContext?: {
    approvedOpportunityIds: string[];
    capabilityAuthorityOpportunityIds: string[];
    pendingCapabilityOpportunityIds: string[];
    futureCapabilityOpportunityIds: string[];
    excludedOpportunityIds: string[];
    evidenceIds: string[];
    referenceInputIds: string[];
    profileIds: string[];
    evidenceClaims: string[];
    referenceGuidance: string[];
    profileGuidance: string[];
    semanticClassifications?: Array<{
      opportunityId: string;
      roles: Array<"CAPABILITY" | "PRODUCT_SERVICE" | "MARKET_VERTICAL" | "AUDIENCE" | "SALES_CHANNEL" | "GEOGRAPHY" | "DELIVERY_MODEL" | "SEO_OPPORTUNITY" | "FUTURE_EXPANSION" | "PROOF_REQUIREMENT">;
      capabilityAuthority: "CURRENT" | "FUTURE" | "REJECTED" | "UNVALIDATED";
      productServiceCandidates: string[];
      marketVerticals: string[];
      audiences: string[];
      salesChannels: string[];
      researchedGeographies: string[];
      deliveryModels: string[];
      seoOpportunities: string[];
      proofRequirements: string[];
    }>;
    opportunityPrioritization?: string[];
    salesChannels?: string[];
    currentServiceGeographies?: string[];
    targetExpansionGeographies?: string[];
    researchedDemandGeographies?: string[];
    locationSeoOpportunities?: string[];
  };
};

export type CapabilityEvidenceOption = {
  referenceId: string;
  sourceType: "OWNER_URL" | "OWNER_UPLOAD" | "OWNER_SUPPLIED_AUTHORITY";
  label: string;
  notes: string | null;
  provenance: string;
  classification: SiteAssetClassification | null;
  createdAt: string;
};

export type CreativeInput = {
  inputId: string;
  kind: "IMAGE" | "SCREENSHOT" | "LOGO" | "PRODUCT_PHOTO" | "FACILITY_PHOTO" | "PROJECT_PHOTO" | "URL" | "TEXT" | "COLOR" | "TYPOGRAPHY" | "LAYOUT" | "TONE";
  reference: string;
  sentiment: "LIKE" | "DISLIKE" | "REFERENCE_ONLY" | "NEUTRAL";
  classification: SiteAssetClassification;
  notes: string | null;
  suppliedBy: string;
  suppliedAt: string;
  binaryAsset: SiteIntelligenceBinaryAsset | null;
};

export const SITE_INTELLIGENCE_REFERENCE_LIMITS = {
  maxCreativeInputs: 200,
  maxUrlReferences: 100,
} as const;

export type SiteIntelligenceBinaryAsset = {
  assetId: string;
  sha256: string;
  originalFileName: string;
  mediaType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  organizationId: string;
  siteId: string;
  providerReference: string;
  provenance: { sourceType: "OWNER_UPLOAD"; sourceReference: string; recordedAt: string };
  classification: SiteAssetClassification;
  note: string | null;
};

export type ImageRequirement = {
  requirementId: string;
  pageSection: string;
  desiredSubject: string;
  aspectOrientation: string;
  purpose: string;
  preferredSource: string;
  approvedAssetAvailable: boolean;
  ownerUploadRecommended: boolean;
  generationCandidate: boolean;
  status: "NEEDED" | "OWNER_UPLOAD_OR_GENERATE_FOR_APPROVAL" | "CANDIDATE_AVAILABLE" | "APPROVED";
};

export type CreativeDirectionProposal = {
  revision: number;
  strategyRevision: number;
  overallDirection: string;
  brandInterpretation: string;
  colorDirection: string;
  typographyDirection: string;
  spacingLayoutDirection: string;
  photographyStyle: string;
  generatedImageStyle: string;
  heroTreatment: string;
  ctaTreatment: string;
  trustProofPresentation: string;
  productPresentation: string;
  verticalPresentation: string;
  mobileConsiderations: string;
  visualDos: string[];
  visualDonts: string[];
  homepageBlueprint: string[];
  imagePlan: ImageRequirement[];
  status: "PROPOSED" | "APPROVED" | "REVISION_REQUESTED" | "REJECTED";
  reason: string;
  createdBy: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
};

export type SiteStrategyAuditEvent = {
  eventId: string;
  action: string;
  actor: string;
  reason: string;
  at: string;
};

export type SiteResearchExecutionState = "QUEUED" | "RESEARCHING" | "SYNTHESIZING" | "READY_FOR_REVIEW" | "FAILED" | "PAUSED" | "RECOVERABLE";
export type SiteResearchExecution = {
  executionId: string;
  organizationId: string;
  siteId: string;
  kind: "INITIAL" | "OPPORTUNITY_CONTINUATION";
  focusOpportunityId: string | null;
  state: SiteResearchExecutionState;
  providerReference: string;
  providerExecutionId?: string | null;
  providerCompletedAt?: string | null;
  attemptCount: number;
  maxAttempts: number;
  timeoutMs: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  evidenceCount: number;
  opportunityCount: number;
};

export type SiteIntelligenceWorkspace = {
  workspaceId: string;
  organizationId: string;
  siteId: string;
  internalOrganizationIdentity: string;
  publicBrandIdentity: string;
  revision: number;
  intelligenceState: SiteIntelligenceState;
  strategyState: SiteStrategyState;
  creativeState: CreativeDirectionState;
  providerReference: string | null;
  researchStartedAt: string | null;
  researchExecutions: SiteResearchExecution[];
  evidence: SiteIntelligenceEvidence[];
  opportunities: SiteOpportunity[];
  strategyRevisions: SiteStrategyProposal[];
  creativeInputs: CreativeInput[];
  creativeRevisions: CreativeDirectionProposal[];
  audit: SiteStrategyAuditEvent[];
  createdAt: string;
  updatedAt: string;
};

export type SiteIntelligenceProvider = {
  providerId: string;
  plan(input: { organizationId: string; siteId: string; approvedSourceReferences: string[] }): Promise<{
    planReference: string;
    providerReference: string;
  }>;
};

export function isPublishableSiteAsset(classification: SiteAssetClassification): boolean {
  return classification === "OWNER_APPROVED_PUBLISHABLE";
}

export function hasVerifiedCapability(opportunity: SiteOpportunity): boolean {
  return getCapabilityAuthorityStatus(opportunity) === "CURRENT";
}

export function getCapabilityEvidencePolicy(opportunity: SiteOpportunity): CapabilityEvidencePolicy {
  const claim = [opportunity.name, opportunity.category, opportunity.problemUseCase, opportunity.rationale, opportunity.recommendation].join(" ");
  if (/\b(certif(?:ied|ication)|regulatory|compliance|compliant|licen[cs](?:e|ed|ing)|UL|NSF|GMP|ISO|formal standard|code[- ]compliant|listed)\b/i.test(claim)) {
    return { requirement: "INDEPENDENT_EVIDENCE_REQUIRED", protectedClaimClass: "COMPLIANCE_OR_CERTIFICATION", reason: "Certification, compliance, licensing, and formal-standard claims require independent proof." };
  }
  if (/\b(service area|coverage area|nationwide service|national service|ships? nationwide|geographic service|territorial coverage)\b/i.test(claim)) {
    return { requirement: "INDEPENDENT_EVIDENCE_REQUIRED", protectedClaimClass: "GEOGRAPHIC_SERVICE", reason: "Geographic service and coverage claims require independent support." };
  }
  if (/\b(authorized dealer|authorized distributor|dealer authority|distributor authority|reseller authority|channel authority|certified partner)\b/i.test(claim)) {
    return { requirement: "INDEPENDENT_EVIDENCE_REQUIRED", protectedClaimClass: "CHANNEL_AUTHORITY", reason: "Dealer, distributor, reseller, and channel-authority claims require independent support." };
  }
  return { requirement: "OWNER_ATTESTATION_ALLOWED", protectedClaimClass: null, reason: null };
}

export function isEvidenceSufficientForCapabilityPolicy(policy: CapabilityEvidencePolicy, relevanceType: CapabilityEvidenceRelevanceType): boolean {
  if (relevanceType === "GENERAL_REFERENCE") return false;
  if (policy.protectedClaimClass === "COMPLIANCE_OR_CERTIFICATION") return relevanceType === "SPECIFICATION_OR_COMPLIANCE_EVIDENCE";
  if (policy.protectedClaimClass === "GEOGRAPHIC_SERVICE") return relevanceType === "GEOGRAPHIC_SERVICE_EVIDENCE";
  if (policy.protectedClaimClass === "CHANNEL_AUTHORITY") return relevanceType === "CHANNEL_EVIDENCE";
  return true;
}

function hasCapabilitySpecificEvidence(opportunity: SiteOpportunity, authority: CapabilityAuthorityDecision): boolean {
  const policy = getCapabilityEvidencePolicy(opportunity);
  const sufficientEvidence = new Set(authority.evidenceRelevance
    .filter((link) => link.opportunityId === opportunity.opportunityId && link.ownerConfirmedRelevant && isEvidenceSufficientForCapabilityPolicy(policy, link.relevanceType))
    .map((link) => link.evidenceId));
  return authority.evidenceIds.some((evidenceId) => sufficientEvidence.has(evidenceId));
}

export function getCapabilityAuthorityAssurance(opportunity: SiteOpportunity): CapabilityAuthorityAssurance {
  if (opportunity.capabilityState !== "VERIFIED" && opportunity.capabilityState !== "QUALIFIED") return "NOT_CURRENT";
  const authority = opportunity.capabilityAuthorityRevisions?.at(-1);
  if (!authority || authority.decision !== opportunity.capabilityState || !authority.attestation.trim()) return "REVIEW_REQUIRED";
  if (authority.decision === "QUALIFIED" && !authority.qualificationNotes?.trim()) return "REVIEW_REQUIRED";
  if (hasCapabilitySpecificEvidence(opportunity, authority)) return "EVIDENCE_VERIFIED";
  return getCapabilityEvidencePolicy(opportunity).requirement === "INDEPENDENT_EVIDENCE_REQUIRED" ? "PROOF_REQUIRED" : "OWNER_ATTESTED";
}

export function getCapabilityAuthorityStatus(opportunity: SiteOpportunity): CapabilityAuthorityStatus {
  const assurance = getCapabilityAuthorityAssurance(opportunity);
  if (assurance === "OWNER_ATTESTED" || assurance === "EVIDENCE_VERIFIED") return "CURRENT";
  return assurance === "NOT_CURRENT" ? "NOT_CURRENT" : "AUTHORITY_REVIEW_REQUIRED";
}

export function canUseOpportunityAsAuthority(opportunity: SiteOpportunity): boolean {
  return opportunity.ownerDecision === "APPROVED" && hasVerifiedCapability(opportunity);
}

export function downstreamGenerationAllowed(workspace: SiteIntelligenceWorkspace): boolean {
  return workspace.intelligenceState === "INTELLIGENCE_APPROVED"
    && workspace.strategyState === "STRATEGY_APPROVED"
    && workspace.creativeState === "CREATIVE_APPROVED"
    && false;
}