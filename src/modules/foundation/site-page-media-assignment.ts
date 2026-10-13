import "server-only";

import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";

const NAMESPACE = "site-page-media-assignment-v1";
export const PRODUCT_AUTHORITY_MEDIA_REQUIRED_WHEN_AVAILABLE = "PRODUCT_AUTHORITY_MEDIA_REQUIRED_WHEN_AVAILABLE" as const;

export type SitePageMediaRole = "PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE" | "LOCAL_CONTEXTUAL_ATMOSPHERE";
export type SitePageMediaReferenceRole = "PRODUCT_TRUTH" | "ENVIRONMENT" | "STYLE";

export type SitePageMediaAssignment = {
  assignmentId: string;
  organizationId: string;
  siteId: string;
  buildSessionId: string;
  pageId: string;
  pageRevisionId: string;
  slotId: string;
  role: SitePageMediaRole;
  asset:
    | {
        type: "APPROVED_EXISTING";
        authorityReference: string;
        productId: string | null;
        wordpressMediaId: number | null;
        url: string;
        sha256: string;
      }
    | {
        type: "GENERATED";
        provider: string;
        model: string;
        generationJobId: string | null;
        effectivePrompt: string;
        referenceInputs: readonly {
          referenceId: string;
          role: SitePageMediaReferenceRole;
          sha256: string;
        }[];
        outputSha256: string;
      };
  metadata: {
    altText: string;
    caption: string | null;
    title: string;
    description: string;
  };
  approval: {
    candidateId: string;
    approvedBy: string;
    approvedAt: string;
  };
  wordpressReceipt: {
    mediaId: number;
    url: string;
    attachedToObjectId: string;
    altTextVerified: boolean;
    placementVerified: boolean;
    verifiedAt: string;
  } | null;
  createdAt: string;
};

type State = { assignments: SitePageMediaAssignment[] };
const seed = (): State => ({ assignments: [] });

function required(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function sha(value: string, code: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error(code);
  return normalized;
}

function validUrl(value: string, code: string): string {
  const normalized = value.trim();
  try {
    const parsed = new URL(normalized);
    if (!parsed.protocol || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) throw new Error(code);
    return normalized;
  } catch {
    throw new Error(code);
  }
}

function validate(input: Omit<SitePageMediaAssignment, "assignmentId" | "createdAt">): void {
  required(input.organizationId, "MEDIA_ASSIGNMENT_ORGANIZATION_REQUIRED");
  required(input.siteId, "MEDIA_ASSIGNMENT_SITE_REQUIRED");
  required(input.buildSessionId, "MEDIA_ASSIGNMENT_SESSION_REQUIRED");
  required(input.pageId, "MEDIA_ASSIGNMENT_PAGE_REQUIRED");
  required(input.pageRevisionId, "MEDIA_ASSIGNMENT_PAGE_REVISION_REQUIRED");
  required(input.slotId, "MEDIA_ASSIGNMENT_SLOT_REQUIRED");
  required(input.metadata.altText, "MEDIA_ASSIGNMENT_ALT_TEXT_REQUIRED");
  required(input.metadata.title, "MEDIA_ASSIGNMENT_TITLE_REQUIRED");
  required(input.metadata.description, "MEDIA_ASSIGNMENT_DESCRIPTION_REQUIRED");
  required(input.approval.candidateId, "MEDIA_ASSIGNMENT_APPROVAL_REQUIRED");
  required(input.approval.approvedBy, "MEDIA_ASSIGNMENT_APPROVER_REQUIRED");
  if (!Number.isFinite(Date.parse(input.approval.approvedAt))) throw new Error("MEDIA_ASSIGNMENT_APPROVAL_TIME_INVALID");

  if (input.role === "PRODUCT_AUTHORITY") {
    if (input.asset.type !== "APPROVED_EXISTING" || !input.asset.productId) {
      throw new Error("PRODUCT_AUTHORITY_MEDIA_MUST_USE_APPROVED_PRODUCT_ASSET");
    }
    required(input.asset.authorityReference, "PRODUCT_MEDIA_AUTHORITY_REFERENCE_REQUIRED");
    sha(input.asset.sha256, "PRODUCT_MEDIA_SHA256_INVALID");
  }

  if (input.asset.type === "GENERATED") {
    if (input.role === "PRODUCT_AUTHORITY") throw new Error("GENERATED_PRODUCT_AUTHORITY_MEDIA_FORBIDDEN");
    required(input.asset.provider, "GENERATED_MEDIA_PROVIDER_REQUIRED");
    required(input.asset.model, "GENERATED_MEDIA_MODEL_REQUIRED");
    required(input.asset.effectivePrompt, "GENERATED_MEDIA_PROMPT_REQUIRED");
    sha(input.asset.outputSha256, "GENERATED_MEDIA_SHA256_INVALID");
    if ((input.role === "CONTEXTUAL_IN_USE" || input.role === "APPLICATION_EXPERIENCE") && !input.asset.referenceInputs.some((reference) => reference.role === "PRODUCT_TRUTH")) {
      throw new Error("CONTEXTUAL_MEDIA_PRODUCT_TRUTH_REFERENCE_REQUIRED");
    }
    for (const reference of input.asset.referenceInputs) {
      required(reference.referenceId, "GENERATED_MEDIA_REFERENCE_ID_REQUIRED");
      sha(reference.sha256, "GENERATED_MEDIA_REFERENCE_SHA256_INVALID");
    }
  }

  if (input.wordpressReceipt) {
    if (!Number.isSafeInteger(input.wordpressReceipt.mediaId) || input.wordpressReceipt.mediaId < 1) throw new Error("WORDPRESS_MEDIA_ID_INVALID");
    required(input.wordpressReceipt.url, "WORDPRESS_MEDIA_URL_REQUIRED");
    required(input.wordpressReceipt.attachedToObjectId, "WORDPRESS_MEDIA_ATTACHMENT_REQUIRED");
    if (!input.wordpressReceipt.altTextVerified || !input.wordpressReceipt.placementVerified) throw new Error("WORDPRESS_MEDIA_READBACK_REQUIRED");
  }
}

export function listSitePageMediaAssignments(input: {
  organizationId: string;
  siteId: string;
  buildSessionId: string;
  pageRevisionId?: string;
}): readonly SitePageMediaAssignment[] {
  const state = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }).state;
  return deepClone(state.assignments.filter((assignment) =>
    assignment.organizationId === input.organizationId
    && assignment.siteId === input.siteId
    && assignment.buildSessionId === input.buildSessionId
    && (!input.pageRevisionId || assignment.pageRevisionId === input.pageRevisionId)));
}

export function resolveApprovedProductAuthorityMedia(input: {
  organizationId: string;
  siteId: string;
  productId: string;
  authorityReference: string;
}): SitePageMediaAssignment | null {
  const state = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }).state;
  const candidates = state.assignments.filter((assignment) =>
    assignment.organizationId === input.organizationId
    && assignment.siteId === input.siteId
    && assignment.role === "PRODUCT_AUTHORITY"
    && assignment.asset.type === "APPROVED_EXISTING"
    && assignment.asset.productId === input.productId
    && assignment.asset.authorityReference === input.authorityReference
    && assignment.approval.approvedBy.trim()
    && Number.isFinite(Date.parse(assignment.approval.approvedAt))
  );
  return candidates.length
    ? deepClone(candidates.sort((left, right) => right.approval.approvedAt.localeCompare(left.approval.approvedAt))[0])
    : null;
}

export function evaluateProductAuthorityMediaRequirement(input: {
  approvedMediaAvailable: boolean;
  resolvedAssignment: SitePageMediaAssignment | null;
}): {
  contract: typeof PRODUCT_AUTHORITY_MEDIA_REQUIRED_WHEN_AVAILABLE;
  state: "PASS" | "FAIL";
  code: "REQUIRED_MEDIA_UNRESOLVED" | null;
  generatedMediaUsedAsDocumentarySubstitute: false;
} {
  const resolved = input.resolvedAssignment?.role === "PRODUCT_AUTHORITY"
    && input.resolvedAssignment.asset.type === "APPROVED_EXISTING";
  return {
    contract: PRODUCT_AUTHORITY_MEDIA_REQUIRED_WHEN_AVAILABLE,
    state: !input.approvedMediaAvailable || resolved ? "PASS" : "FAIL",
    code: input.approvedMediaAvailable && !resolved ? "REQUIRED_MEDIA_UNRESOLVED" : null,
    generatedMediaUsedAsDocumentarySubstitute: false,
  };
}

export function saveSitePageMediaAssignment(input: Omit<SitePageMediaAssignment, "assignmentId" | "createdAt">): SitePageMediaAssignment {
  validate(input);
  const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
  if (loaded.state.assignments.some((assignment) =>
    assignment.organizationId === input.organizationId
    && assignment.siteId === input.siteId
    && assignment.buildSessionId === input.buildSessionId
    && assignment.pageRevisionId === input.pageRevisionId
    && assignment.slotId === input.slotId)) {
    throw new Error("MEDIA_ASSIGNMENT_SLOT_ALREADY_BOUND");
  }
  const assignment: SitePageMediaAssignment = {
    ...deepClone(input),
    assignmentId: `media-assignment-${input.pageRevisionId}-${input.slotId}`,
    createdAt: new Date().toISOString(),
  };
  loaded.state.assignments.push(assignment);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(assignment);
}

export function bindSitePageMediaAssignmentWordPress(input: {
  organizationId: string;
  siteId: string;
  buildSessionId: string;
  pageRevisionId: string;
  slotId: string;
  role: SitePageMediaRole;
  generationJobId: string;
  mediaId: number;
  url: string;
  attachedToObjectId: string;
  verifiedAt?: string;
}): SitePageMediaAssignment {
  const organizationId = required(input.organizationId, "MEDIA_ASSIGNMENT_ORGANIZATION_REQUIRED");
  const siteId = required(input.siteId, "MEDIA_ASSIGNMENT_SITE_REQUIRED");
  const buildSessionId = required(input.buildSessionId, "MEDIA_ASSIGNMENT_SESSION_REQUIRED");
  const pageRevisionId = required(input.pageRevisionId, "MEDIA_ASSIGNMENT_PAGE_REVISION_REQUIRED");
  const slotId = required(input.slotId, "MEDIA_ASSIGNMENT_SLOT_REQUIRED");
  const generationJobId = required(input.generationJobId, "GENERATED_MEDIA_GENERATION_ID_REQUIRED");
  if (!Number.isSafeInteger(input.mediaId) || input.mediaId < 1) throw new Error("WORDPRESS_MEDIA_ID_INVALID");
  const url = validUrl(input.url, "WORDPRESS_MEDIA_URL_REQUIRED");
  const attachedToObjectId = required(input.attachedToObjectId, "WORDPRESS_MEDIA_ATTACHMENT_REQUIRED");
  const verifiedAt = input.verifiedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(verifiedAt))) throw new Error("WORDPRESS_MEDIA_VERIFIED_AT_INVALID");

  const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
  const assignment = loaded.state.assignments.find((candidate) =>
    candidate.organizationId === organizationId
    && candidate.siteId === siteId
    && candidate.buildSessionId === buildSessionId
    && candidate.pageRevisionId === pageRevisionId
    && candidate.slotId === slotId
    && candidate.role === input.role
  );
  if (!assignment) throw new Error("MEDIA_ASSIGNMENT_WORDPRESS_BINDING_NOT_FOUND");
  if (assignment.asset.type !== "GENERATED") throw new Error("MEDIA_ASSIGNMENT_WORDPRESS_BINDING_GENERATED_REQUIRED");
  if (assignment.asset.generationJobId !== generationJobId) throw new Error("MEDIA_ASSIGNMENT_WORDPRESS_BINDING_GENERATION_MISMATCH");

  if (assignment.wordpressReceipt) {
    if (
      assignment.wordpressReceipt.mediaId === input.mediaId
      && assignment.wordpressReceipt.url === url
      && assignment.wordpressReceipt.attachedToObjectId === attachedToObjectId
    ) {
      return deepClone(assignment);
    }
    throw new Error("MEDIA_ASSIGNMENT_WORDPRESS_BINDING_COLLISION");
  }

  assignment.wordpressReceipt = {
    mediaId: input.mediaId,
    url,
    attachedToObjectId,
    altTextVerified: true,
    placementVerified: true,
    verifiedAt,
  };
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(assignment);
}

export function evaluateSitePageImagePackage(input: {
  assignments: readonly SitePageMediaAssignment[];
  pageRevisionId: string;
  approvedProductImageAvailable: boolean;
  contextualPolicy: "DESIRED" | "REQUIRED";
}): {
  ready: boolean;
  degraded: boolean;
  productAuthorityImage: SitePageMediaAssignment | null;
  contextualInUseImage: SitePageMediaAssignment | null;
  blockers: readonly string[];
  warnings: readonly string[];
} {
  const current = input.assignments.filter((assignment) => assignment.pageRevisionId === input.pageRevisionId);
  const productAuthorityImage = current.find((assignment) => assignment.role === "PRODUCT_AUTHORITY") ?? null;
  const contextualInUseImage = current.find((assignment) => assignment.role === "CONTEXTUAL_IN_USE") ?? null;
  const blockers = [
    ...(input.approvedProductImageAvailable && !productAuthorityImage ? ["APPROVED_PRODUCT_AUTHORITY_IMAGE_REQUIRED"] : []),
    ...(input.contextualPolicy === "REQUIRED" && !contextualInUseImage ? ["CONTEXTUAL_IN_USE_IMAGE_REQUIRED"] : []),
  ];
  const warnings = input.contextualPolicy === "DESIRED" && !contextualInUseImage
    ? ["CONTEXTUAL_IN_USE_IMAGE_UNAVAILABLE_USING_PRODUCT_IMAGE_ONLY"]
    : [];
  return { ready: blockers.length === 0, degraded: blockers.length === 0 && warnings.length > 0, productAuthorityImage, contextualInUseImage, blockers, warnings };
}
