import "server-only";

import { load } from "cheerio";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { renderedVisualPublicationEligible } from "@/modules/foundation/rendered-visual-certification";
import { getRenderedVisualCertificationById, listRenderedVisualOwnerDecisions } from "@/modules/foundation/rendered-visual-certification-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { listExactPublicationRollbackReceipts, EXACT_WORDPRESS_PUBLICATION, EXACT_WORDPRESS_ROLLBACK, type ExactWordPressOperation } from "./exact-publication-rollback-authority";
import { storedPostContentSha, type ExactWordPressAuthoritySnapshot } from "./exact-publication-rollback-service";
import { resolveTargetParameterizedRichReferenceProduction } from "./target-parameterized-rich-reference-production";

function field(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

export async function resolveExactPublicationRollbackLiveAuthority(input: {
  campaignId: string;
  targetId: string;
  operation: ExactWordPressOperation;
  visualCertificationId?: string | null;
  sourcePublicationReceiptId?: string | null;
  runtimeSha: string;
}) {
  const target = await resolveTargetParameterizedRichReferenceProduction({ campaignId: input.campaignId, targetId: input.targetId });
  const site = getSiteById(target.identity.siteId);
  if (!site || site.organizationId !== target.identity.organizationId || !site.integrations.wordpressApiBaseUrl || !target.identity.wordpressObjectId) throw new Error("EXACT_OPERATION_TARGET_AUTHORITY_UNAVAILABLE");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential) throw new Error("EXACT_OPERATION_WORDPRESS_CREDENTIAL_REQUIRED");
  const reader = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
  const read = async (): Promise<ExactWordPressAuthoritySnapshot> => {
    const response = await reader.getJson({ path: `/pages/${target.identity.wordpressObjectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent,title,featured_media,content" }) });
    if (!response.ok || !response.body || typeof response.body !== "object" || Array.isArray(response.body)) throw new Error("EXACT_OPERATION_WORDPRESS_READ_FAILED");
    const page = response.body as Record<string, unknown>;
    const content = page.content && typeof page.content === "object" && !Array.isArray(page.content) ? page.content as Record<string, unknown> : {};
    const title = page.title && typeof page.title === "object" && !Array.isArray(page.title) ? page.title as Record<string, unknown> : {};
    return { organizationId: target.identity.organizationId, siteId: target.identity.siteId, campaignId: target.target.campaignId, productId: target.identity.productId, targetId: target.target.targetId, stateCode: target.target.stateCode, wordpressObjectId: String(page.id ?? ""), parentObjectId: String(page.parent ?? ""), slug: field(page.slug), canonicalPath: target.identity.canonicalPath, status: field(page.status) as "draft" | "publish", rawPostContent: field(content.raw), title: field(title.raw), featuredMediaId: Number(page.featured_media ?? 0) };
  };
  const snapshot = await read();
  const $ = load(snapshot.rawPostContent, null, false);
  const expectedH1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!expectedH1 || $("h1").length !== 1) throw new Error("EXACT_OPERATION_STORED_H1_REQUIRED");

  const sourceReceipt = input.operation === EXACT_WORDPRESS_ROLLBACK
    ? listExactPublicationRollbackReceipts().find((receipt) => receipt.receiptId === input.sourcePublicationReceiptId && receipt.operation === EXACT_WORDPRESS_PUBLICATION && receipt.afterStatus === "publish") ?? null
    : null;
  if (input.operation === EXACT_WORDPRESS_ROLLBACK && !sourceReceipt) throw new Error("EXACT_ROLLBACK_SOURCE_PUBLICATION_RECEIPT_REQUIRED");
  const visualCertificationId = input.operation === EXACT_WORDPRESS_PUBLICATION ? input.visualCertificationId?.trim() ?? "" : sourceReceipt!.visualCertificationId;
  const draftCertification = getRenderedVisualCertificationById({ organizationId: target.identity.organizationId, siteId: target.identity.siteId, certificationId: visualCertificationId });
  if (!draftCertification) throw new Error("EXACT_OPERATION_VISUAL_CERTIFICATION_NOT_FOUND");
  if (input.operation === EXACT_WORDPRESS_PUBLICATION) {
    const ownerDecision = listRenderedVisualOwnerDecisions(visualCertificationId).at(-1) ?? null;
    if (!renderedVisualPublicationEligible({ certification: draftCertification, decision: ownerDecision, currentIdentity: draftCertification.identity })) throw new Error("EXACT_PUBLICATION_CURRENT_OWNER_APPROVAL_REQUIRED");
  }

  const context = {
    operation: input.operation,
    organizationId: target.identity.organizationId,
    siteId: target.identity.siteId,
    campaignId: target.target.campaignId,
    productId: target.identity.productId,
    targetId: target.target.targetId,
    stateCode: target.target.stateCode,
    wordpressObjectId: snapshot.wordpressObjectId,
    parentObjectId: snapshot.parentObjectId,
    slug: snapshot.slug,
    canonicalPath: target.identity.canonicalPath,
    expectedH1,
    expectedTitle: snapshot.title,
    featuredMediaId: snapshot.featuredMediaId,
    storedPostContentSha: storedPostContentSha(snapshot.rawPostContent),
    visualCertificationId,
    runtimeSha: input.runtimeSha,
    expectedCurrentStatus: input.operation === EXACT_WORDPRESS_PUBLICATION ? "draft" as const : "publish" as const,
    intendedStatus: input.operation === EXACT_WORDPRESS_PUBLICATION ? "publish" as const : "draft" as const,
    sourcePublicationReceiptId: input.operation === EXACT_WORDPRESS_ROLLBACK ? sourceReceipt!.receiptId : null,
  };
  return { context, snapshot, draftCertification, sourceReceipt, site, readExactWordPressAuthority: read };
}

export { EXACT_WORDPRESS_PUBLICATION, EXACT_WORDPRESS_ROLLBACK };
