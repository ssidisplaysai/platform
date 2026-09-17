import { load } from "cheerio";
import type { ContextualMediaRole, ContextualVisualSlot } from "./contextual-media-production-adapter";

export type ContextualPresentationReplacement = { slot: ContextualVisualSlot; role: string; mediaRole: ContextualMediaRole; mediaId: number; url: string; assetSha256: string };

export type ResolvedContextualPresentationSlot = {
  role: string;
  requestedSlot: ContextualVisualSlot;
  actualSection: string;
  selector: string;
  placement: "IMAGE" | "BACKGROUND";
};

const candidates: Record<ContextualVisualSlot, readonly Omit<ResolvedContextualPresentationSlot, "role" | "requestedSlot">[]> = {
  HERO_EXPERIENCE: [
    { actualSection: "HERO", selector: "[data-reference-section=HERO] > img", placement: "IMAGE" },
  ],
  POST_HERO_CONTEXTUAL: [
    { actualSection: "PRODUCT_IDENTITY", selector: "[data-reference-section=PRODUCT_IDENTITY] img", placement: "IMAGE" },
    { actualSection: "VISUAL_APPLICATION", selector: "[data-reference-section=VISUAL_APPLICATION] img", placement: "IMAGE" },
    { actualSection: "APPLICATIONS", selector: "[data-reference-section=APPLICATIONS] img", placement: "IMAGE" },
  ],
  APPLICATION_STAGE: [
    { actualSection: "APPLICATIONS", selector: "[data-reference-section=APPLICATIONS] .saw-application-stage img", placement: "IMAGE" },
    { actualSection: "APPLICATIONS", selector: "[data-reference-section=APPLICATIONS] img", placement: "IMAGE" },
    { actualSection: "VISUAL_APPLICATION", selector: "[data-reference-section=VISUAL_APPLICATION] img", placement: "IMAGE" },
  ],
  CTA_ATMOSPHERE: [
    { actualSection: "CTA", selector: "[data-reference-section=CTA]", placement: "BACKGROUND" },
  ],
};

export function resolveContextualPresentationSlots(contentHtml: string, requests: readonly Pick<ContextualPresentationReplacement, "role" | "slot">[]): readonly ResolvedContextualPresentationSlot[] {
  const $ = load(contentHtml, null, false); const root = $(".saw-page");
  if (root.length !== 1) throw new Error("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");
  const used = new Set<unknown>();
  return requests.map((request) => {
    for (const candidate of candidates[request.slot]) {
      const targets = root.find(candidate.selector);
      if (targets.length !== 1 || used.has(targets[0])) continue;
      used.add(targets[0]);
      return { role: request.role, requestedSlot: request.slot, ...candidate };
    }
    throw new Error(`CONTEXTUAL_MEDIA_PRESENTATION_SLOT_MISSING:${request.slot}`);
  });
}

export function patchContextualPresentationMedia(contentHtml: string, replacements: readonly ContextualPresentationReplacement[]): string {
  const $ = load(contentHtml, null, false); const root = $(".saw-page");
  if (root.length !== 1) throw new Error("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");
  const resolved = resolveContextualPresentationSlots(contentHtml, replacements);
  for (let index = 0; index < replacements.length; index += 1) {
    const replacement = replacements[index]; const placement = resolved[index];
    if (!/^https:\/\//i.test(replacement.url) || !Number.isSafeInteger(replacement.mediaId) || replacement.mediaId < 1 || !/^[a-f0-9]{64}$/.test(replacement.assetSha256)) throw new Error("CONTEXTUAL_MEDIA_PRESENTATION_REPLACEMENT_INVALID");
    const target = root.find(placement.selector);
    if (placement.placement === "BACKGROUND") {
        const currentStyle = target.attr("style")?.trim().replace(/;?$/, ";") ?? "";
        target.attr("style", `${currentStyle}background-image:linear-gradient(90deg,rgba(7,17,25,.94),rgba(7,17,25,.66)),url('${replacement.url}');background-size:cover;background-position:center;`).attr("data-generated-background-url", replacement.url).attr("data-media-id", String(replacement.mediaId)).attr("data-media-role", replacement.mediaRole).attr("data-contextual-role", replacement.role).attr("data-generated-asset-sha", replacement.assetSha256);
      continue;
    }
    target.attr("src", replacement.url).attr("data-media-id", String(replacement.mediaId)).attr("data-media-role", replacement.mediaRole).attr("data-contextual-role", replacement.role).attr("data-generated-asset-sha", replacement.assetSha256);
    target.closest("section").attr("data-generated-contextual-media", "true");
  }
  root.attr("data-media-provenance", "GENESIS_GENERATED_CONTEXTUAL_MEDIA_V1");
  return $.html();
}