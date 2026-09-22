import "server-only";

import { createHash } from "node:crypto";
import type { SharedRichPageProductionProfile } from "@/modules/foundation/shared-rich-page-production-authority";
import type { SitePageMediaAssignment } from "@/modules/foundation/site-page-media-assignment";
import type { GenesisWordPressDraftArtifact, GenesisWordPressDraftWriteResult } from "@/modules/foundation/wordpress-draft-writer";
import type { GlwGeneratedDraftArtifact } from "./page-execution";
import { evaluateGlwReferenceOwnerReviewReadiness } from "./reference-owner-review-readiness";
import { produceTargetRichReferenceArtifact } from "./target-rich-reference-artifact-producer";

export const TARGET_RICH_REFERENCE_PRODUCTION_OPERATION_VERSION = "GENESIS_TARGET_RICH_REFERENCE_PRODUCTION_OPERATION_V1" as const;

type StoredDraft = {
  wordpressObjectId: string;
  wordpressUrl: string;
  status: "draft";
  slug: string;
  parentId: number;
  title: string;
  contentHtml: string;
  featuredMediaId: number;
  nativeTitleSuppressed: boolean;
};

type ActualHostCertification = {
  certificationId: string;
  overallState: "PASS";
  contentHash: string;
  wordpressObjectId: string;
};

export type TargetRichReferenceProductionDependencies = {
  writeDraft(input: { operation: "CREATE" | "UPDATE"; wordpressObjectId: string | null; artifact: GenesisWordPressDraftArtifact }): Promise<GenesisWordPressDraftWriteResult>;
  suppressNativeTitle(input: { wordpressObjectId: string; expectedStatus: "draft"; expectedContentSha: string; expectedTitle: string; expectedSlug: string; expectedParentId: number; expectedFeaturedMediaId: number }): Promise<void>;
  readStoredDraft(wordpressObjectId: string): Promise<StoredDraft>;
  certifyActualHost(input: { wordpressObjectId: string; canonicalPath: string; contentSha: string; actor: string }): Promise<ActualHostCertification>;
};

function sha256(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

export async function runTargetRichReferenceProductionOperation(input: {
  target: { targetId: string; stateCode: string; stateName: string; canonicalPath: string; wordpressObjectId: string | null; wordpressParentId: string };
  product: { productId: string; productName: string; canonicalPath: string };
  semanticArtifact: GlwGeneratedDraftArtifact;
  referenceArtifactHtml: string;
  mediaAssignments: readonly SitePageMediaAssignment[];
  profile: SharedRichPageProductionProfile;
  actor: string;
  dependencies: TargetRichReferenceProductionDependencies;
}) {
  const parentId = Number(input.target.wordpressParentId);
  if (!Number.isSafeInteger(parentId) || parentId < 1) throw new Error("TARGET_RICH_REFERENCE_PARENT_INVALID");
  const featuredMediaId = 0;

  const produced = produceTargetRichReferenceArtifact(input);
  const draftArtifact: GenesisWordPressDraftArtifact = {
    title: produced.artifact.title,
    contentHtml: produced.artifact.contentHtml,
    slug: input.target.canonicalPath,
    excerpt: produced.artifact.excerpt,
    parentId,
    seo: produced.artifact.focusKeyphrase && produced.artifact.seoTitle && produced.artifact.metaDescription
      ? { focusKeyphrase: produced.artifact.focusKeyphrase, seoTitle: produced.artifact.seoTitle, metaDescription: produced.artifact.metaDescription }
      : null,
  };
  const write = await input.dependencies.writeDraft({ operation: input.target.wordpressObjectId ? "UPDATE" : "CREATE", wordpressObjectId: input.target.wordpressObjectId, artifact: draftArtifact });
  if (!write.ok || write.wordpressStatus !== "draft") throw new Error(`TARGET_RICH_REFERENCE_DRAFT_WRITE_FAILED:${write.ok ? "STATUS" : write.state}`);

  await input.dependencies.suppressNativeTitle({ wordpressObjectId: write.wordpressObjectId, expectedStatus: "draft", expectedContentSha: produced.artifactSha, expectedTitle: produced.artifact.title, expectedSlug: input.target.canonicalPath.split("/").filter(Boolean).at(-1)!, expectedParentId: parentId, expectedFeaturedMediaId: featuredMediaId });
  const stored = await input.dependencies.readStoredDraft(write.wordpressObjectId);
  if (stored.wordpressObjectId !== write.wordpressObjectId || stored.status !== "draft" || stored.parentId !== parentId || stored.slug !== input.target.canonicalPath.split("/").filter(Boolean).at(-1) || stored.title !== produced.artifact.title || stored.featuredMediaId !== featuredMediaId || !stored.nativeTitleSuppressed || sha256(stored.contentHtml) !== produced.artifactSha) throw new Error("TARGET_RICH_REFERENCE_STORED_DRAFT_MISMATCH");

  const certification = await input.dependencies.certifyActualHost({ wordpressObjectId: stored.wordpressObjectId, canonicalPath: input.target.canonicalPath, contentSha: produced.artifactSha, actor: input.actor });
  if (certification.overallState !== "PASS" || certification.wordpressObjectId !== stored.wordpressObjectId || certification.contentHash !== produced.artifactSha) throw new Error("TARGET_RICH_REFERENCE_ACTUAL_HOST_CERTIFICATION_FAILED");
  const media = { productAuthorityMediaAvailable: true, productAuthorityMediaCount: input.mediaAssignments.filter((item) => item.role === "PRODUCT_AUTHORITY").length, contextualMediaCount: input.mediaAssignments.filter((item) => item.role === "CONTEXTUAL_IN_USE").length, applicationMediaCount: input.mediaAssignments.filter((item) => item.role === "APPLICATION_EXPERIENCE").length, localContextualMediaCount: input.mediaAssignments.filter((item) => item.role === "LOCAL_CONTEXTUAL_ATMOSPHERE").length, featuredMediaId };
  const ownerReview = evaluateGlwReferenceOwnerReviewReadiness({ artifact: { ...produced.artifact, contentHtml: stored.contentHtml }, target: { productName: input.product.productName, productCanonicalPath: input.product.canonicalPath, stateName: input.target.stateName }, media, actualHostVisualCertified: true, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  if (!ownerReview.ready) throw new Error(`TARGET_RICH_REFERENCE_OWNER_REVIEW_BLOCKED:${ownerReview.blockers.join(",")}`);

  const brandCertification = {
    contract: produced.presentation.contract,
    LEDDisplayWarehouseBrandDistinctiveness: produced.presentation.ok ? "PASS" as const : "FAIL" as const,
    CommercialStainlessPresentationLeakage: "commercialStainlessPresentationLeakage" in produced.presentation.checks
      ? produced.presentation.checks.commercialStainlessPresentationLeakage
      : null,
    structuralChecks: produced.presentation.checks,
    blockers: produced.presentation.blockers,
  };
  return { version: TARGET_RICH_REFERENCE_PRODUCTION_OPERATION_VERSION, targetId: input.target.targetId, artifact: produced, wordpress: stored, certification: { ...certification, brand: brandCertification }, ownerReview, ownerDecision: "PENDING" as const, wordpressMutation: true, publicationMutation: false as const, generationAttempted: false as const, n8nExecutionCreated: false as const, imageGenerationAttempted: false as const };
}
