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
};

export type CreativeInput = {
  inputId: string;
  kind: "IMAGE" | "SCREENSHOT" | "LOGO" | "PRODUCT_PHOTO" | "FACILITY_PHOTO" | "PROJECT_PHOTO" | "URL" | "TEXT" | "COLOR" | "TYPOGRAPHY" | "LAYOUT" | "TONE";
  reference: string;
  sentiment: "LIKE" | "DISLIKE" | "NEUTRAL";
  classification: SiteAssetClassification;
  notes: string | null;
  suppliedBy: string;
  suppliedAt: string;
  binaryAsset: SiteIntelligenceBinaryAsset | null;
};

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
  return opportunity.capabilityState === "VERIFIED" || opportunity.capabilityState === "QUALIFIED";
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