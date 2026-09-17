import "server-only";

import { bindGeneratedContextualMediaWordPress, findSuccessfulGeneratedContextualMedia, saveSuccessfulGeneratedContextualMedia } from "@/modules/foundation/generated-contextual-media-repository";
import { listSitePageMediaAssignments, saveSitePageMediaAssignment } from "@/modules/foundation/site-page-media-assignment";
import { uploadGenesisWordPressGeneratedMedia } from "@/modules/foundation/wordpress-media-writer";
import type { SiteConfiguration } from "@/modules/foundation/types";
import type { ContextualMediaAdapterDependencies } from "./contextual-media-production-adapter";
import { generateGenesisFeaturedImageWithCampaignReferences } from "./reference-aware-image-service";

export function createContextualMediaProductionDependencies(input: {
  site: SiteConfiguration;
  siteName: string;
  productName: string;
  patchPresentation: ContextualMediaAdapterDependencies["patchPresentation"];
  certify: ContextualMediaAdapterDependencies["certify"];
}): ContextualMediaAdapterDependencies {
  return {
    findSuccessfulGeneration: findSuccessfulGeneratedContextualMedia,
    generate: async ({ identity, item }) => {
      const result = await generateGenesisFeaturedImageWithCampaignReferences({ prompt: item.prompt, siteName: input.siteName, productTopic: input.productName, campaignId: identity.campaignId });
      if (!result.ok) throw new Error(`CONTEXTUAL_MEDIA_GENERATION_FAILED:${result.state}`);
      return { bytes: result.image.bytes, mimeType: result.image.mimeType, provider: result.image.provider, model: result.image.model, width: result.image.width, height: result.image.height, reportedCost: null };
    },
    persistGeneration: saveSuccessfulGeneratedContextualMedia,
    persistAssignment: ({ identity, item, asset, productAuthority, actor }) => {
      const buildSessionId = `contextual-media:${identity.targetId}`;
      const existing = listSitePageMediaAssignments({ organizationId: identity.organizationId, siteId: identity.siteId, buildSessionId, pageRevisionId: identity.pageRevisionId }).find((assignment) => assignment.slotId === item.slot);
      if (existing) {
        if (existing.asset.type !== "GENERATED" || existing.asset.generationJobId !== asset.receipt.generationId || existing.role !== item.mediaRole) throw new Error("CONTEXTUAL_MEDIA_ASSIGNMENT_COLLISION");
        return existing;
      }
      const productSha = productAuthority.asset.type === "APPROVED_EXISTING" ? productAuthority.asset.sha256 : "";
      return saveSitePageMediaAssignment({ organizationId: identity.organizationId, siteId: identity.siteId, buildSessionId, pageId: identity.targetId, pageRevisionId: identity.pageRevisionId, slotId: item.slot, role: item.mediaRole, asset: { type: "GENERATED", provider: asset.receipt.provider, model: asset.receipt.model, generationJobId: asset.receipt.generationId, effectivePrompt: item.prompt, referenceInputs: item.mediaRole === "LOCAL_CONTEXTUAL_ATMOSPHERE" ? [] : [{ referenceId: productAuthority.assignmentId, role: "PRODUCT_TRUTH", sha256: productSha }], outputSha256: asset.receipt.assetSha256 }, metadata: { altText: item.altText, caption: "Conceptual generated visualization; not documentary evidence.", title: item.role.replaceAll("_", " "), description: "Generated contextual presentation media. Not installation, customer, geographic, or product-specification evidence." }, approval: { candidateId: asset.receipt.generationId, approvedBy: actor, approvedAt: new Date().toISOString() }, wordpressReceipt: asset.wordpressMediaId && asset.wordpressUrl ? { mediaId: asset.wordpressMediaId, url: asset.wordpressUrl, attachedToObjectId: identity.wordpressObjectId, altTextVerified: true, placementVerified: true, verifiedAt: new Date().toISOString() } : null });
    },
    uploadMedia: async ({ identity, item, asset }) => {
      if (asset.wordpressMediaId && asset.wordpressUrl) return { mediaId: asset.wordpressMediaId, url: asset.wordpressUrl };
      const uploaded = await uploadGenesisWordPressGeneratedMedia({ site: input.site, canonicalSlug: `${identity.targetId}-${item.role.toLowerCase().replaceAll("_", "-")}`, image: { bytes: asset.bytes, mimeType: asset.receipt.mimeType, fileExtension: asset.receipt.mimeType === "image/png" ? "png" : asset.receipt.mimeType === "image/webp" ? "webp" : "jpg" }, title: item.role.replaceAll("_", " "), altText: item.altText, description: "Conceptual generated visualization; not documentary installation, customer, geographic, or product-specification evidence." });
      if (!uploaded.ok) throw new Error(`CONTEXTUAL_MEDIA_WORDPRESS_UPLOAD_FAILED:${uploaded.state}`);
      bindGeneratedContextualMediaWordPress({ generationId: asset.receipt.generationId, mediaId: uploaded.mediaId, url: uploaded.mediaUrl });
      return { mediaId: uploaded.mediaId, url: uploaded.mediaUrl };
    },
    patchPresentation: input.patchPresentation,
    certify: input.certify,
  };
}

export function inertContextualMediaDependencies(): ContextualMediaAdapterDependencies {
  const forbidden = () => { throw new Error("DRY_RUN_SIDE_EFFECT_FORBIDDEN"); };
  return { findSuccessfulGeneration: forbidden, generate: forbidden, persistGeneration: forbidden, persistAssignment: forbidden, uploadMedia: forbidden, patchPresentation: forbidden, certify: forbidden } as ContextualMediaAdapterDependencies;
}