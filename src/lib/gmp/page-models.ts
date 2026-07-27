import { randomUUID } from "node:crypto";

export const gmpPageTypes = [
  "home",
  "product",
  "service",
  "industry",
  "application",
  "comparison",
  "faq",
  "about",
  "contact",
  "landing",
] as const;

export const gmpPageLifecycleStates = ["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"] as const;
export const gmpPageArtifactStatuses = ["DRAFT", "REQUIRES_REVIEW", "APPROVED", "REJECTED", "ARCHIVED"] as const;
export const gmpSectionTypes = [
  "hero",
  "overview",
  "benefits",
  "features",
  "specifications",
  "use_cases",
  "proof",
  "faq",
  "cta",
] as const;

export type GmpPageType = (typeof gmpPageTypes)[number];
export type GmpPageLifecycleState = (typeof gmpPageLifecycleStates)[number];
export type GmpPageArtifactStatus = (typeof gmpPageArtifactStatuses)[number];
export type GmpSectionType = (typeof gmpSectionTypes)[number];

export const GMP_PAGE_PLANNING_MODEL_VERSION = "gmp-page-plan/v1";
export const GMP_PAGE_READINESS_MODEL_VERSION = "gmp-page-readiness/v1";

export type GmpPage = {
  pageId: string;
  projectId: string;
  siteId: string;
  parentPageId?: string;
  pageType: GmpPageType;
  pageTemplateType: string;
  name: string;
  slug: string;
  canonicalUrl: string;
  proposedUrl?: string;
  title: string;
  workingTitle?: string;
  summary?: string;
  purpose?: string;
  primaryObjective?: string;
  secondaryObjectives: string[];
  lifecycleState: GmpPageLifecycleState;
  contentState: string;
  seoState: string;
  publishingState: string;
  priority: number;
  locale: string;
  language: string;
  audienceReferences: string[];
  productReferences: string[];
  serviceReferences: string[];
  industryReferences: string[];
  applicationReferences: string[];
  knowledgeWorkspaceVersion: number;
  brandProfileVersion: number;
  currentBriefId?: string;
  currentContentPlanId?: string;
  currentApprovedRevisionId?: string;
  publishingConnectionId?: string;
  intent: Record<string, unknown>;
  createdBy: string;
  metadata?: Record<string, unknown>;
  version: number;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GmpPageBrief = {
  briefId: string;
  projectId: string;
  pageId: string;
  briefVersion: number;
  status: GmpPageArtifactStatus;
  purpose?: string;
  audience?: string;
  userNeed?: string;
  businessGoal?: string;
  primaryTopic?: string;
  secondaryTopics: string[];
  primaryKeyword?: string;
  secondaryKeywords: string[];
  searchIntent?: string;
  funnelStage?: string;
  valueProposition?: string;
  requiredClaims: string[];
  requiredProofPoints: string[];
  requiredProductsOrServices: string[];
  requiredApplications: string[];
  requiredIndustries: string[];
  requiredTechnicalSpecifications: string[];
  requiredFaqs: string[];
  restrictedMessaging: string[];
  conversionGoal?: string;
  primaryCta?: string;
  secondaryCta?: string;
  competitorContext: Record<string, unknown>;
  toneGuidance?: string;
  evidenceRequirements: string[];
  knowledgeRecordReferences: string[];
  sourceReferences: string[];
  approvedAt?: string | null;
  approvedBy?: string | null;
  metadata?: Record<string, unknown>;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GmpContentPlan = {
  contentPlanId: string;
  projectId: string;
  pageId: string;
  pageBriefId: string;
  planVersion: number;
  status: GmpPageArtifactStatus;
  planningModelVersion: string;
  targetWordRange: { min: number; max: number };
  readingLevel?: string;
  requiredSectionCount: number;
  optionalSectionCount: number;
  sectionOrder: string[];
  internalLinkRequirements: Array<Record<string, unknown>>;
  externalEvidenceRequirements: string[];
  structuredDataRequirements: string[];
  mediaRequirements: string[];
  ctaRequirements: string[];
  seoRequirements: string[];
  accessibilityRequirements: string[];
  approvalRequirements: string[];
  readinessScore: number;
  approvedAt?: string | null;
  approvedBy?: string | null;
  metadata?: Record<string, unknown>;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GmpPageSection = {
  sectionId: string;
  projectId: string;
  pageId: string;
  contentPlanId: string;
  parentSectionId?: string;
  sectionType: GmpSectionType;
  sectionKey: string;
  position: number;
  headingLevel: number;
  workingHeading?: string;
  purpose?: string;
  audienceNeed?: string;
  requiredKnowledgeRecords: string[];
  requiredClaims: string[];
  requiredEvidence: string[];
  requiredProducts: string[];
  requiredServices: string[];
  requiredSpecifications: string[];
  requiredFaqs: string[];
  targetWordRange: { min: number; max: number };
  ctaType?: string;
  mediaRequirement: Record<string, unknown>;
  internalLinkRequirement: Record<string, unknown>;
  structuredDataContribution: Record<string, unknown>;
  optional: boolean;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpPageRelationship = {
  relationshipId: string;
  projectId: string;
  sourcePageId: string;
  targetPageId: string;
  relationshipType: string;
  priority: number;
  reason?: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpInternalLinkPlan = {
  internalLinkPlanId: string;
  projectId: string;
  sourcePageId: string;
  targetPageId: string;
  sourcePageRefId: string;
  targetPageRefId: string;
  linkPurpose: string;
  anchorTextGuidance?: string;
  requirementLevel: string;
  sectionPlacement?: string;
  priority: number;
  status: string;
  reason?: string;
  knowledgeRelationship?: string;
  seoRelationship?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpPageReadinessAssessment = {
  pageReadinessAssessmentId: string;
  projectId: string;
  pageId: string;
  scoringModelVersion: string;
  overallScore: number;
  planningReadiness: number;
  knowledgeReadiness: number;
  seoReadiness: number;
  evidenceReadiness: number;
  linkingReadiness: number;
  blockingIssues: string[];
  warnings: string[];
  recommendations: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpPageKnowledgeReference = {
  pageKnowledgeReferenceId: string;
  projectId: string;
  pageId: string;
  pageBriefId?: string;
  contentPlanId?: string;
  knowledgeWorkspaceId: string;
  knowledgeRecordId: string;
  knowledgeRecordVersion: number;
  required: boolean;
  role?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpPageSourceReference = {
  pageSourceReferenceId: string;
  projectId: string;
  pageId: string;
  pageBriefId?: string;
  contentPlanId?: string;
  sourceId: string;
  required: boolean;
  role?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function normalizePageSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function parsePageType(value: unknown): GmpPageType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase() as GmpPageType;
  return gmpPageTypes.includes(normalized) ? normalized : null;
}

export function buildPage(input: {
  projectId: string;
  siteId: string;
  actorId: string;
  pageType: GmpPageType;
  name: string;
  slug?: string;
  title: string;
  pageTemplateType?: string;
  locale?: string;
  language?: string;
  knowledgeWorkspaceVersion?: number;
  brandProfileVersion?: number;
  metadata?: Record<string, unknown>;
}): GmpPage {
  const createdAt = nowIso();
  const slug = normalizePageSlug(input.slug ?? input.name);
  return {
    pageId: `gmppg_${randomUUID()}`,
    projectId: input.projectId,
    siteId: input.siteId,
    pageType: input.pageType,
    pageTemplateType: input.pageTemplateType ?? input.pageType,
    name: input.name.trim(),
    slug,
    canonicalUrl: `/${slug}`,
    title: input.title.trim(),
    secondaryObjectives: [],
    lifecycleState: "DRAFT",
    contentState: "DRAFT",
    seoState: "DRAFT",
    publishingState: "NOT_READY",
    priority: 50,
    locale: input.locale ?? "en-US",
    language: input.language ?? "en",
    audienceReferences: [],
    productReferences: [],
    serviceReferences: [],
    industryReferences: [],
    applicationReferences: [],
    knowledgeWorkspaceVersion: input.knowledgeWorkspaceVersion ?? 1,
    brandProfileVersion: input.brandProfileVersion ?? 1,
    intent: {},
    createdBy: input.actorId,
    metadata: input.metadata,
    version: 1,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

export function validatePageCreateInput(input: Record<string, unknown> | null):
  | { ok: true; value: { siteId: string; pageType: GmpPageType; name: string; slug?: string; title: string; locale?: string; language?: string; metadata?: Record<string, unknown> } }
  | { ok: false; error: string } {
  if (!input) return { ok: false, error: "Request body must be valid JSON." };
  if (typeof input.siteId !== "string" || input.siteId.trim().length < 3) {
    return { ok: false, error: "siteId is required." };
  }
  const pageType = parsePageType(input.pageType);
  if (!pageType) {
    return { ok: false, error: "A valid pageType is required." };
  }
  if (typeof input.name !== "string" || input.name.trim().length < 2) {
    return { ok: false, error: "name is required." };
  }
  if (typeof input.title !== "string" || input.title.trim().length < 2) {
    return { ok: false, error: "title is required." };
  }

  return {
    ok: true,
    value: {
      siteId: input.siteId,
      pageType,
      name: input.name,
      slug: typeof input.slug === "string" ? input.slug : undefined,
      title: input.title,
      locale: typeof input.locale === "string" ? input.locale : undefined,
      language: typeof input.language === "string" ? input.language : undefined,
      metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata as Record<string, unknown> : undefined,
    },
  };
}

export function validatePageBriefInput(input: Record<string, unknown> | null):
  | { ok: true; value: Partial<GmpPageBrief> }
  | { ok: false; error: string } {
  if (!input) return { ok: false, error: "Request body must be valid JSON." };
  const asStringArray = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];

  return {
    ok: true,
    value: {
      purpose: typeof input.purpose === "string" ? input.purpose : undefined,
      audience: typeof input.audience === "string" ? input.audience : undefined,
      userNeed: typeof input.userNeed === "string" ? input.userNeed : undefined,
      businessGoal: typeof input.businessGoal === "string" ? input.businessGoal : undefined,
      primaryTopic: typeof input.primaryTopic === "string" ? input.primaryTopic : undefined,
      secondaryTopics: asStringArray(input.secondaryTopics),
      primaryKeyword: typeof input.primaryKeyword === "string" ? input.primaryKeyword : undefined,
      secondaryKeywords: asStringArray(input.secondaryKeywords),
      searchIntent: typeof input.searchIntent === "string" ? input.searchIntent : undefined,
      funnelStage: typeof input.funnelStage === "string" ? input.funnelStage : undefined,
      valueProposition: typeof input.valueProposition === "string" ? input.valueProposition : undefined,
      requiredClaims: asStringArray(input.requiredClaims),
      requiredProofPoints: asStringArray(input.requiredProofPoints),
      requiredProductsOrServices: asStringArray(input.requiredProductsOrServices),
      requiredApplications: asStringArray(input.requiredApplications),
      requiredIndustries: asStringArray(input.requiredIndustries),
      requiredTechnicalSpecifications: asStringArray(input.requiredTechnicalSpecifications),
      requiredFaqs: asStringArray(input.requiredFaqs),
      restrictedMessaging: asStringArray(input.restrictedMessaging),
      conversionGoal: typeof input.conversionGoal === "string" ? input.conversionGoal : undefined,
      primaryCta: typeof input.primaryCta === "string" ? input.primaryCta : undefined,
      secondaryCta: typeof input.secondaryCta === "string" ? input.secondaryCta : undefined,
      competitorContext: typeof input.competitorContext === "object" && input.competitorContext !== null
        ? input.competitorContext as Record<string, unknown>
        : {},
      toneGuidance: typeof input.toneGuidance === "string" ? input.toneGuidance : undefined,
      evidenceRequirements: asStringArray(input.evidenceRequirements),
      knowledgeRecordReferences: asStringArray(input.knowledgeRecordReferences),
      sourceReferences: asStringArray(input.sourceReferences),
      metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata as Record<string, unknown> : undefined,
    },
  };
}
