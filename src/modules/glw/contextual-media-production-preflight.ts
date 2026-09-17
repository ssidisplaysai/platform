import "server-only";

import type { SitePageMediaAssignment } from "@/modules/foundation/site-page-media-assignment";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { runContextualMediaProductionAdapter, type ContextualVisualPlanItem } from "./contextual-media-production-adapter";
import { inertContextualMediaDependencies } from "./contextual-media-production-dependencies";
import { getProductMediaAuthorityContent, listProductMediaAuthority } from "./product-media-authority";
import { resolveGenesisImageProviderConfiguration } from "./generated-image-service";
import { resolveTargetParameterizedRichReferenceProduction } from "./target-parameterized-rich-reference-production";

export async function resolveContextualMediaProductionAuthority(input: { campaignId: string; targetId: string }) {
  const readiness = await resolveTargetParameterizedRichReferenceProduction({ campaignId: input.campaignId, targetId: input.targetId });
  const site = getSiteById(readiness.identity.siteId); const product = getProductById(readiness.identity.productId);
  if (!site || !product || !readiness.identity.wordpressObjectId || !readiness.authority.candidateArtifactIdentity) throw new Error("CONTEXTUAL_MEDIA_TARGET_DRAFT_REQUIRED");
  const records = listProductMediaAuthority({ organizationId: readiness.identity.organizationId, siteId: readiness.identity.siteId, productId: readiness.identity.productId });
  const record = records.find((candidate) => candidate.mediaAuthorityId === readiness.authority.heroMediaAuthorityId && candidate.ownerApproval === "APPROVED" && candidate.productRepresentationAllowed) ?? null;
  const content = record ? getProductMediaAuthorityContent({ mediaAuthorityId: record.mediaAuthorityId, organizationId: readiness.identity.organizationId, siteId: readiness.identity.siteId, productId: readiness.identity.productId }) : null;
  if (!record || !content) throw new Error("CONTEXTUAL_MEDIA_PRODUCT_AUTHORITY_REQUIRED");
  const productAuthority = { assignmentId: `product-authority:${record.mediaAuthorityId}`, organizationId: readiness.identity.organizationId, siteId: readiness.identity.siteId, buildSessionId: `contextual-media:${readiness.target.targetId}`, pageId: readiness.target.targetId, pageRevisionId: readiness.authority.candidateArtifactIdentity, slotId: "PRODUCT_AUTHORITY", role: "PRODUCT_AUTHORITY", asset: { type: "APPROVED_EXISTING", authorityReference: `product-media:${record.mediaAuthorityId}`, productId: readiness.identity.productId, wordpressMediaId: null, url: `data:${record.mimeType};base64,${content.bytes.toString("base64")}`, sha256: content.hash }, metadata: { altText: record.altTextAuthority, caption: record.captionAuthority || null, title: product.productName, description: record.provenance }, approval: { candidateId: record.mediaAuthorityId, approvedBy: record.ownerPrincipalId ?? "owner-approved-product-media", approvedAt: record.ownerApprovalTimestamp ?? record.updatedAt }, wordpressReceipt: null, createdAt: record.createdAt } satisfies SitePageMediaAssignment;
  const provider = resolveGenesisImageProviderConfiguration();
  return { readiness, site, product, productAuthority, provider };
}

export async function preflightContextualMediaProduction(input: { campaignId: string; targetId: string; visualPlan: readonly ContextualVisualPlanItem[]; actor: string }) {
  const { readiness, productAuthority, provider } = await resolveContextualMediaProductionAuthority(input);
  const result = await runContextualMediaProductionAdapter({ mode: "DRY_RUN", identity: { organizationId: readiness.identity.organizationId, siteId: readiness.identity.siteId, campaignId: readiness.target.campaignId, targetId: readiness.target.targetId, productId: readiness.identity.productId, wordpressObjectId: readiness.identity.wordpressObjectId, pageRevisionId: readiness.authority.candidateArtifactIdentity }, visualPlan: input.visualPlan, productAuthority, providerReady: provider.configured, actor: input.actor, dependencies: inertContextualMediaDependencies() });
  return { result, provider: { provider: provider.provider, model: provider.model, configured: provider.configured, monetaryCostTelemetryAvailable: provider.monetaryCostTelemetryAvailable }, target: readiness.target, identity: readiness.identity, productAuthority: { mediaAuthorityId: productAuthority.approval.candidateId, protected: true as const }, siteResolved: true as const, productResolved: true as const };
}