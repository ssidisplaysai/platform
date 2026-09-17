import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { FoundationPersistenceConflictError, deepClone, loadPersistedState, savePersistedState } from "@/modules/foundation/foundation-persistence";
import { listRenderedVisualCertifications, listRenderedVisualOwnerDecisions } from "@/modules/foundation/rendered-visual-certification-repository";
import { renderedVisualDecisionCurrency } from "@/modules/foundation/rendered-visual-certification";
import { getSiteById } from "@/modules/foundation/site-repository";
import type { GenesisWordPressExactStatusTransitionResult } from "@/modules/foundation/wordpress-publish-writer";
import { transitionGenesisWordPressPageStatus } from "@/modules/foundation/wordpress-publish-writer";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { listGlwCampaigns } from "./campaign-repository";
import { listGlwCampaignTargets, reconcileGlwCampaignTargetDraftAfterPublicationFailure } from "./campaign-target-repository";
import { EXACT_WORDPRESS_PUBLICATION, listExactPublicationRollbackReceipts } from "./exact-publication-rollback-authority";
import { reconcileGlwPageExecutionDraftAfterUnauthorizedPublicationIncident, glwPageExecutionRepository } from "./page-execution-repository";
import { evaluateProductMediaReadiness, listProductMediaAuthority } from "./product-media-authority";
import type { GlwTrustedOperatorPrincipal } from "./trusted-operator-principal";

export const GLW_UNAUTHORIZED_PUBLICATION_INCIDENT_ROLLBACK_VERSION = "GLW_UNAUTHORIZED_PUBLICATION_INCIDENT_ROLLBACK_V1" as const;
export const INCIDENT_OWNER_AUTHORIZATION_CONFIRMATION = "OWNER_AUTHORIZED_UNAUTHORIZED_PUBLICATION_INCIDENT_ROLLBACK_V1" as const;

type GateCode = "OWNER_DECISION_ABSENT" | "VISUAL_CERTIFICATION_PASS_ABSENT" | "PRODUCT_AUTHORITY_UNSATISFIED";

type WordPressLiveSnapshot = {
  wordpressObjectId: string;
  status: "draft" | "publish";
  slug: string;
  parentObjectId: string;
  title: string;
  featuredMediaId: number;
  rawPostContent: string;
};

export type UnauthorizedPublicationIncidentGateEvidence = {
  publicationPolicyRequiresGates: true;
  ownerDecisionPresent: boolean;
  visualCertificationPassPresent: boolean;
  productAuthoritySatisfied: boolean;
  missingRequiredGates: readonly GateCode[];
  productAuthorityBlockers: readonly string[];
};

export type UnauthorizedPublicationIncidentRollbackPreflight = {
  contractVersion: typeof GLW_UNAUTHORIZED_PUBLICATION_INCIDENT_ROLLBACK_VERSION;
  contextFingerprint: string;
  runtimeSha: string;
  identity: {
    organizationId: string;
    siteId: string;
    campaignId: string;
    targetId: string;
    stateCode: string;
    citySlug: string | null;
    productId: string;
    jobId: string;
    executionId: string;
    wordpressObjectId: string;
  };
  before: {
    wordpressStatus: "publish";
    targetStatus: "published";
    executionStatus: "COMPLETE";
    executionWordPressStatus: string | null;
    wordpressUrl: string | null;
    storedPostContentSha: string;
  };
  evidence: {
    gateEvidence: UnauthorizedPublicationIncidentGateEvidence;
    noValidExactPublicationReceipt: true;
  };
  mutationIntent: {
    wordpressStatusTransition: "publish_to_draft";
    lifecycleReconciliation: "published_to_draft_ready";
    generationAttempted: false;
    imageGenerationAttempted: false;
    dispatchAttempted: false;
    n8nExecutionCreated: false;
    publicationAttempted: false;
  };
};

export type UnauthorizedPublicationIncidentOwnerAuthorization = {
  confirm: typeof INCIDENT_OWNER_AUTHORIZATION_CONFIRMATION;
  ownerPrincipalId: string;
  incidentReason: string;
};

export type UnauthorizedPublicationIncidentRollbackAuditRecord = {
  recordId: string;
  contractVersion: typeof GLW_UNAUTHORIZED_PUBLICATION_INCIDENT_ROLLBACK_VERSION;
  recordedAt: string;
  runtimeSha: string;
  contextFingerprint: string;
  principalId: string;
  principalSessionId: string;
  ownerAuthorization: UnauthorizedPublicationIncidentOwnerAuthorization;
  identity: UnauthorizedPublicationIncidentRollbackPreflight["identity"];
  before: UnauthorizedPublicationIncidentRollbackPreflight["before"];
  after: {
    wordpressStatus: "draft";
    targetStatus: "draft_ready";
    executionWordPressStatus: "draft";
    wordpressUrl: string | null;
    storedPostContentSha: string;
  };
  evidence: UnauthorizedPublicationIncidentRollbackPreflight["evidence"];
  mutationPerformed: true;
};

type State = {
  records: UnauthorizedPublicationIncidentRollbackAuditRecord[];
};

const NAMESPACE = "glw-unauthorized-publication-incident-rollback-v1";
const seed = (): State => ({ records: [] });

function sha(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

function required(value: unknown, code: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(code);
  return normalized;
}

function runtimeSha(value: unknown): string {
  const normalized = required(value, "INCIDENT_ROLLBACK_RUNTIME_SHA_REQUIRED").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) throw new Error("INCIDENT_ROLLBACK_RUNTIME_SHA_INVALID");
  return normalized;
}

function hashContent(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

function parseWordPressSnapshot(input: Record<string, unknown>): WordPressLiveSnapshot {
  const content = input.content && typeof input.content === "object" && !Array.isArray(input.content)
    ? input.content as Record<string, unknown>
    : {};
  const title = input.title && typeof input.title === "object" && !Array.isArray(input.title)
    ? input.title as Record<string, unknown>
    : {};
  const status = typeof input.status === "string" ? input.status.trim() : "";
  if (status !== "draft" && status !== "publish") throw new Error("INCIDENT_ROLLBACK_WORDPRESS_STATUS_INVALID");
  const wordpressObjectId = String(input.id ?? "").trim();
  const parentObjectId = String(input.parent ?? "").trim();
  if (!/^[1-9]\d*$/.test(wordpressObjectId) || !/^[0-9]\d*$/.test(parentObjectId)) throw new Error("INCIDENT_ROLLBACK_WORDPRESS_IDENTITY_INVALID");
  return {
    wordpressObjectId,
    status,
    slug: typeof input.slug === "string" ? input.slug.trim() : "",
    parentObjectId,
    title: typeof title.raw === "string" ? title.raw.trim() : "",
    featuredMediaId: Number(input.featured_media ?? 0),
    rawPostContent: typeof content.raw === "string" ? content.raw : "",
  };
}

async function readWordPressLive(input: { siteId: string; wordpressObjectId: string }): Promise<WordPressLiveSnapshot> {
  const site = getSiteById(input.siteId);
  if (!site?.integrations.wordpressApiBaseUrl) throw new Error("INCIDENT_ROLLBACK_WORDPRESS_SITE_AUTHORITY_UNAVAILABLE");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential) throw new Error("INCIDENT_ROLLBACK_WORDPRESS_CREDENTIAL_REQUIRED");
  const reader = createAuthenticatedWordPressReadAuthority({
    configuration: {
      apiBaseUrl: site.integrations.wordpressApiBaseUrl,
      username: credential.username,
      applicationPassword: credential.applicationPassword,
      timeoutMs: 30_000,
    },
  });
  const response = await reader.getJson({
    path: `/pages/${input.wordpressObjectId}`,
    query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,title,featured_media,content" }),
  });
  if (!response.ok || !response.body || typeof response.body !== "object" || Array.isArray(response.body)) {
    throw new Error("INCIDENT_ROLLBACK_WORDPRESS_READ_FAILED");
  }
  return parseWordPressSnapshot(response.body as Record<string, unknown>);
}

function evaluateMissingGateEvidence(input: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  targetId: string;
  productId: string;
  stateCode: string;
  jobId: string;
  executionId: string;
  wordpressObjectId: string;
  contentSha: string;
}): UnauthorizedPublicationIncidentGateEvidence {
  const visualCertifications = listRenderedVisualCertifications({
    organizationId: input.organizationId,
    siteId: input.siteId,
    pageId: input.targetId,
  }).filter((certification) => certification.overallState === "PASS"
    && certification.identity.campaignId === input.campaignId
    && certification.identity.targetId === input.targetId
    && certification.identity.jobId === input.jobId
    && certification.identity.externalExecutionId === input.executionId
    && certification.identity.wordpressObjectId === input.wordpressObjectId
    && certification.identity.contentHash === input.contentSha);

  const visualCertificationPassPresent = visualCertifications.length > 0;
  const ownerDecisionPresent = visualCertifications.some((certification) => {
    const decision = listRenderedVisualOwnerDecisions(certification.certificationId).at(-1) ?? null;
    return decision?.decision === "APPROVED"
      && renderedVisualDecisionCurrency({
        certification,
        decision,
        currentIdentity: certification.identity,
      }) === "CURRENT";
  });

  let productAuthoritySatisfied = false;
  let productAuthorityBlockers: readonly string[] = ["PRODUCT_AUTHORITY_SCOPE_UNAVAILABLE"];
  try {
    const readiness = evaluateProductMediaReadiness(
      listProductMediaAuthority({
        organizationId: input.organizationId,
        siteId: input.siteId,
        productId: input.productId,
      }),
      { stateCode: input.stateCode },
    );
    productAuthoritySatisfied = readiness.ready;
    productAuthorityBlockers = readiness.blockers;
  } catch {
    productAuthoritySatisfied = false;
  }

  const missingRequiredGates: GateCode[] = [
    ...(!ownerDecisionPresent ? ["OWNER_DECISION_ABSENT" as const] : []),
    ...(!visualCertificationPassPresent ? ["VISUAL_CERTIFICATION_PASS_ABSENT" as const] : []),
    ...(!productAuthoritySatisfied ? ["PRODUCT_AUTHORITY_UNSATISFIED" as const] : []),
  ];

  return {
    publicationPolicyRequiresGates: true,
    ownerDecisionPresent,
    visualCertificationPassPresent,
    productAuthoritySatisfied,
    missingRequiredGates,
    productAuthorityBlockers,
  };
}

function hasValidPublicationReceipt(input: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  targetId: string;
  stateCode: string;
  wordpressObjectId: string;
  contentSha: string;
}): boolean {
  return listExactPublicationRollbackReceipts().some((receipt) => receipt.operation === EXACT_WORDPRESS_PUBLICATION
    && receipt.organizationId === input.organizationId
    && receipt.siteId === input.siteId
    && receipt.campaignId === input.campaignId
    && receipt.targetId === input.targetId
    && receipt.stateCode === input.stateCode
    && receipt.wordpressObjectId === input.wordpressObjectId
    && receipt.afterStatus === "publish"
    && receipt.afterContentSha === input.contentSha);
}

export async function runUnauthorizedPublicationIncidentRollbackPreflight(input: {
  campaignId: string;
  targetId: string;
  jobId: string;
  executionId: string;
  wordpressObjectId: string;
  runtimeSha: string;
}): Promise<UnauthorizedPublicationIncidentRollbackPreflight> {
  const campaignId = required(input.campaignId, "INCIDENT_ROLLBACK_CAMPAIGN_ID_REQUIRED");
  const targetId = required(input.targetId, "INCIDENT_ROLLBACK_TARGET_ID_REQUIRED");
  const jobId = required(input.jobId, "INCIDENT_ROLLBACK_JOB_ID_REQUIRED");
  const executionId = required(input.executionId, "INCIDENT_ROLLBACK_EXECUTION_ID_REQUIRED");
  const wordpressObjectId = required(input.wordpressObjectId, "INCIDENT_ROLLBACK_WORDPRESS_OBJECT_ID_REQUIRED");
  const runtime = runtimeSha(input.runtimeSha);

  const campaign = listGlwCampaigns().find((entry) => entry.campaignId === campaignId) ?? null;
  if (!campaign) throw new Error("INCIDENT_ROLLBACK_CAMPAIGN_NOT_FOUND");
  if (campaign.publicationPolicy !== "publish_after_gates") throw new Error("INCIDENT_ROLLBACK_POLICY_INELIGIBLE");

  const target = listGlwCampaignTargets(campaignId).find((entry) => entry.targetId === targetId) ?? null;
  if (!target) throw new Error("INCIDENT_ROLLBACK_TARGET_NOT_FOUND");
  if (target.organizationId !== campaign.organizationId
    || target.siteId !== campaign.siteId
    || target.productId !== campaign.productId) {
    throw new Error("INCIDENT_ROLLBACK_TARGET_SCOPE_MISMATCH");
  }
  if (target.status !== "published") throw new Error("INCIDENT_ROLLBACK_TARGET_NOT_PUBLISHED");
  if (target.jobId !== jobId || target.wordpressObjectId !== wordpressObjectId) throw new Error("INCIDENT_ROLLBACK_TARGET_IDENTITY_MISMATCH");

  const job = await glwPageExecutionRepository.getById(jobId);
  if (!job) throw new Error("INCIDENT_ROLLBACK_EXECUTION_NOT_FOUND");
  if (job.organizationId !== campaign.organizationId
    || job.siteId !== campaign.siteId
    || job.productId !== campaign.productId
    || job.externalExecutionId !== executionId
    || job.wordpressObjectId !== wordpressObjectId
    || job.status !== "COMPLETE") {
    throw new Error("INCIDENT_ROLLBACK_EXECUTION_IDENTITY_MISMATCH");
  }

  const beforeWordPress = await readWordPressLive({ siteId: campaign.siteId, wordpressObjectId });
  if (beforeWordPress.wordpressObjectId !== wordpressObjectId) throw new Error("INCIDENT_ROLLBACK_WORDPRESS_IDENTITY_MISMATCH");
  if (beforeWordPress.status !== "publish") throw new Error("INCIDENT_ROLLBACK_WORDPRESS_NOT_PUBLISHED");
  const contentSha = hashContent(beforeWordPress.rawPostContent);

  if (hasValidPublicationReceipt({
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    campaignId,
    targetId,
    stateCode: target.stateCode,
    wordpressObjectId,
    contentSha,
  })) {
    throw new Error("INCIDENT_ROLLBACK_VALID_PUBLICATION_RECEIPT_EXISTS");
  }

  const gateEvidence = evaluateMissingGateEvidence({
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    campaignId,
    targetId,
    productId: campaign.productId,
    stateCode: target.stateCode,
    jobId,
    executionId,
    wordpressObjectId,
    contentSha,
  });

  if (gateEvidence.missingRequiredGates.length < 1) {
    throw new Error("INCIDENT_ROLLBACK_MISSING_GATE_EVIDENCE_REQUIRED");
  }

  const preflight: UnauthorizedPublicationIncidentRollbackPreflight = {
    contractVersion: GLW_UNAUTHORIZED_PUBLICATION_INCIDENT_ROLLBACK_VERSION,
    runtimeSha: runtime,
    contextFingerprint: "",
    identity: {
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      campaignId,
      targetId,
      stateCode: target.stateCode,
      citySlug: target.citySlug ?? null,
      productId: campaign.productId,
      jobId,
      executionId,
      wordpressObjectId,
    },
    before: {
      wordpressStatus: "publish",
      targetStatus: "published",
      executionStatus: "COMPLETE",
      executionWordPressStatus: job.wordpressStatus,
      wordpressUrl: job.wordpressUrl,
      storedPostContentSha: contentSha,
    },
    evidence: {
      gateEvidence,
      noValidExactPublicationReceipt: true,
    },
    mutationIntent: {
      wordpressStatusTransition: "publish_to_draft",
      lifecycleReconciliation: "published_to_draft_ready",
      generationAttempted: false,
      imageGenerationAttempted: false,
      dispatchAttempted: false,
      n8nExecutionCreated: false,
      publicationAttempted: false,
    },
  };

  preflight.contextFingerprint = sha(JSON.stringify(preflight));
  return preflight;
}

function saveAuditRecord(record: UnauthorizedPublicationIncidentRollbackAuditRecord): UnauthorizedPublicationIncidentRollbackAuditRecord {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
    const next = deepClone(loaded.state);
    next.records.push(record);
    try {
      savePersistedState({ namespace: NAMESPACE, state: next, expectedRevision: loaded.revision });
      return deepClone(record);
    } catch (error) {
      if (!(error instanceof FoundationPersistenceConflictError) || attempt === 7) throw error;
    }
  }
  throw new Error("INCIDENT_ROLLBACK_AUDIT_CAS_RETRY_EXHAUSTED");
}

export async function executeUnauthorizedPublicationIncidentRollback(input: {
  preflight: UnauthorizedPublicationIncidentRollbackPreflight;
  principal: GlwTrustedOperatorPrincipal;
  ownerAuthorization: UnauthorizedPublicationIncidentOwnerAuthorization;
}): Promise<UnauthorizedPublicationIncidentRollbackAuditRecord> {
  const ownerPrincipalId = required(input.ownerAuthorization.ownerPrincipalId, "INCIDENT_ROLLBACK_OWNER_PRINCIPAL_REQUIRED");
  if (input.ownerAuthorization.confirm !== INCIDENT_OWNER_AUTHORIZATION_CONFIRMATION) {
    throw new Error("INCIDENT_ROLLBACK_OWNER_AUTHORIZATION_REQUIRED");
  }
  if (ownerPrincipalId !== input.principal.principalId.trim()) {
    throw new Error("INCIDENT_ROLLBACK_OWNER_PRINCIPAL_MISMATCH");
  }
  const incidentReason = required(input.ownerAuthorization.incidentReason, "INCIDENT_ROLLBACK_OWNER_REASON_REQUIRED");

  const verified = await runUnauthorizedPublicationIncidentRollbackPreflight({
    campaignId: input.preflight.identity.campaignId,
    targetId: input.preflight.identity.targetId,
    jobId: input.preflight.identity.jobId,
    executionId: input.preflight.identity.executionId,
    wordpressObjectId: input.preflight.identity.wordpressObjectId,
    runtimeSha: input.preflight.runtimeSha,
  });

  if (verified.contextFingerprint !== input.preflight.contextFingerprint) {
    throw new Error("INCIDENT_ROLLBACK_PREFLIGHT_SUPERSEDED");
  }

  const site = getSiteById(verified.identity.siteId);
  if (!site || site.organizationId !== verified.identity.organizationId) {
    throw new Error("INCIDENT_ROLLBACK_SITE_AUTHORITY_UNAVAILABLE");
  }

  const beforeWordPress = await readWordPressLive({
    siteId: verified.identity.siteId,
    wordpressObjectId: verified.identity.wordpressObjectId,
  });
  const transition: GenesisWordPressExactStatusTransitionResult = await transitionGenesisWordPressPageStatus({
    site,
    identity: {
      wordpressObjectId: verified.identity.wordpressObjectId,
      parentObjectId: beforeWordPress.parentObjectId,
      slug: beforeWordPress.slug,
      expectedTitle: beforeWordPress.title,
      featuredMediaId: beforeWordPress.featuredMediaId,
      storedPostContentSha: verified.before.storedPostContentSha,
    },
    expectedStatus: "publish",
    intendedStatus: "draft",
  });
  if (!transition.ok) throw new Error(`INCIDENT_ROLLBACK_WORDPRESS_${transition.state.toUpperCase()}`);

  const afterWordPress = await readWordPressLive({
    siteId: verified.identity.siteId,
    wordpressObjectId: verified.identity.wordpressObjectId,
  });
  if (afterWordPress.status !== "draft") throw new Error("INCIDENT_ROLLBACK_WORDPRESS_DRAFT_VERIFICATION_FAILED");
  if (hashContent(afterWordPress.rawPostContent) !== verified.before.storedPostContentSha) {
    throw new Error("INCIDENT_ROLLBACK_WORDPRESS_CONTENT_DRIFT_DETECTED");
  }

  const target = reconcileGlwCampaignTargetDraftAfterPublicationFailure({
    campaignId: verified.identity.campaignId,
    stateCode: verified.identity.stateCode,
    citySlug: verified.identity.citySlug ?? "",
    jobId: verified.identity.jobId,
    wordpressObjectId: verified.identity.wordpressObjectId,
  });

  const execution = await reconcileGlwPageExecutionDraftAfterUnauthorizedPublicationIncident({
    jobId: verified.identity.jobId,
    externalExecutionId: verified.identity.executionId,
    wordpressObjectId: verified.identity.wordpressObjectId,
    wordpressUrl: transition.wordpressUrl,
    reason: incidentReason,
    rollbackAuditId: `incident-rollback-${verified.identity.wordpressObjectId}`,
  });

  const record = saveAuditRecord({
    recordId: `incident-rollback-record-${randomUUID()}`,
    contractVersion: GLW_UNAUTHORIZED_PUBLICATION_INCIDENT_ROLLBACK_VERSION,
    recordedAt: new Date().toISOString(),
    runtimeSha: verified.runtimeSha,
    contextFingerprint: verified.contextFingerprint,
    principalId: input.principal.principalId,
    principalSessionId: input.principal.sessionId,
    ownerAuthorization: {
      confirm: INCIDENT_OWNER_AUTHORIZATION_CONFIRMATION,
      ownerPrincipalId,
      incidentReason,
    },
    identity: verified.identity,
    before: verified.before,
    after: {
      wordpressStatus: "draft",
      targetStatus: target.status,
      executionWordPressStatus: execution.wordpressStatus === "draft" ? "draft" : "draft",
      wordpressUrl: transition.wordpressUrl,
      storedPostContentSha: verified.before.storedPostContentSha,
    },
    evidence: verified.evidence,
    mutationPerformed: true,
  });

  return record;
}

export function listUnauthorizedPublicationIncidentRollbackAuditRecords(): readonly UnauthorizedPublicationIncidentRollbackAuditRecord[] {
  return deepClone(loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }).state.records);
}
