import { createHash } from "node:crypto";

export const GLW_REFERENCE_CONTENT_RECONCILIATION_VERSION =
  "GLW_REFERENCE_CONTENT_RECONCILIATION_V1";

export type GlwReferenceContentReconciliationReceipt = {
  version: typeof GLW_REFERENCE_CONTENT_RECONCILIATION_VERSION;
  organizationId: string;
  siteId: string;
  campaignId: string;
  stateCode: string;
  jobId: string;
  wordpressObjectId: string;
  artifactSha256: string;
  storedContentSha256: string;
  artifactLength: number;
  storedContentLength: number;
  visibleTextSha256: string;
  relationship: "EXACT" | "MARKUP_ONLY";
  materialContentChanged: false;
  mediaAuthority: "UNGOVERNED" | "GOVERNED";
  hostCertification: "PENDING" | "COMPLETE";
  qaPolicyVersion: string;
  receiptFingerprint: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeReferenceVisibleText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function createGlwReferenceContentReconciliationReceipt(input: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  stateCode: string;
  jobId: string;
  wordpressObjectId: string;
  artifactHtml: string;
  storedContentHtml: string;
  expectedArtifactSha256: string;
  expectedStoredContentSha256: string;
  mediaAuthority: "UNGOVERNED" | "GOVERNED";
  hostCertification: "PENDING" | "COMPLETE";
  qaPolicyVersion: string;
}): GlwReferenceContentReconciliationReceipt {
  const artifactSha256 = sha256(input.artifactHtml);
  const storedContentSha256 = sha256(input.storedContentHtml);
  if (artifactSha256 !== input.expectedArtifactSha256) throw new Error("REFERENCE_ARTIFACT_HASH_MISMATCH");
  if (storedContentSha256 !== input.expectedStoredContentSha256) throw new Error("REFERENCE_STORED_CONTENT_HASH_MISMATCH");
  const artifactText = normalizeReferenceVisibleText(input.artifactHtml);
  const storedText = normalizeReferenceVisibleText(input.storedContentHtml);
  if (artifactText !== storedText) throw new Error("REFERENCE_MATERIAL_CONTENT_DRIFT");
  const semantic: Omit<GlwReferenceContentReconciliationReceipt, "receiptFingerprint"> = {
    version: GLW_REFERENCE_CONTENT_RECONCILIATION_VERSION,
    organizationId: input.organizationId,
    siteId: input.siteId,
    campaignId: input.campaignId,
    stateCode: input.stateCode,
    jobId: input.jobId,
    wordpressObjectId: input.wordpressObjectId,
    artifactSha256,
    storedContentSha256,
    artifactLength: input.artifactHtml.length,
    storedContentLength: input.storedContentHtml.length,
    visibleTextSha256: sha256(artifactText),
    relationship: artifactSha256 === storedContentSha256 ? "EXACT" : "MARKUP_ONLY",
    materialContentChanged: false,
    mediaAuthority: input.mediaAuthority,
    hostCertification: input.hostCertification,
    qaPolicyVersion: input.qaPolicyVersion,
  };
  return {
    ...semantic,
    receiptFingerprint: sha256(JSON.stringify(semantic)),
  };
}