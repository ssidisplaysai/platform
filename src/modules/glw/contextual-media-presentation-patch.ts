import { load } from "cheerio";
import type { ContextualMediaRole, ContextualVisualSlot } from "./contextual-media-production-adapter";

export type ContextualPresentationReplacement = { slot: ContextualVisualSlot; role: string; mediaRole: ContextualMediaRole; mediaId: number; url: string; assetSha256: string };

const selectors: Record<Exclude<ContextualVisualSlot, "CTA_ATMOSPHERE">, string> = {
  HERO_EXPERIENCE: "[data-reference-section=HERO] > img",
  POST_HERO_CONTEXTUAL: "[data-reference-section=PRODUCT_IDENTITY] img",
  APPLICATION_STAGE: "[data-reference-section=APPLICATIONS] .saw-application-stage img",
};

export function patchContextualPresentationMedia(contentHtml: string, replacements: readonly ContextualPresentationReplacement[]): string {
  const $ = load(contentHtml, null, false); const root = $(".saw-page");
  if (root.length !== 1) throw new Error("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");
  for (const replacement of replacements) {
    if (!/^https:\/\//i.test(replacement.url) || !Number.isSafeInteger(replacement.mediaId) || replacement.mediaId < 1 || !/^[a-f0-9]{64}$/.test(replacement.assetSha256)) throw new Error("CONTEXTUAL_MEDIA_PRESENTATION_REPLACEMENT_INVALID");
    if (replacement.slot === "CTA_ATMOSPHERE") {
      const target = root.find("[data-reference-section=CTA]");
      if (target.length !== 1) throw new Error("CONTEXTUAL_MEDIA_PRESENTATION_SLOT_MISSING:CTA_ATMOSPHERE");
        const currentStyle = target.attr("style")?.trim().replace(/;?$/, ";") ?? "";
        target.attr("style", `${currentStyle}background-image:linear-gradient(90deg,rgba(7,17,25,.94),rgba(7,17,25,.66)),url('${replacement.url}');background-size:cover;background-position:center;`).attr("data-generated-background-url", replacement.url).attr("data-media-id", String(replacement.mediaId)).attr("data-media-role", replacement.mediaRole).attr("data-contextual-role", replacement.role).attr("data-generated-asset-sha", replacement.assetSha256);
      continue;
    }
    const target = root.find(selectors[replacement.slot]);
    if (target.length !== 1) throw new Error(`CONTEXTUAL_MEDIA_PRESENTATION_SLOT_MISSING:${replacement.slot}`);
    target.attr("src", replacement.url).attr("data-media-id", String(replacement.mediaId)).attr("data-media-role", replacement.mediaRole).attr("data-contextual-role", replacement.role).attr("data-generated-asset-sha", replacement.assetSha256);
    target.closest("section").attr("data-generated-contextual-media", "true");
  }
  root.attr("data-media-provenance", "GENESIS_GENERATED_CONTEXTUAL_MEDIA_V1");
  return $.html();
}