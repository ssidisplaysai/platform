import { load } from "cheerio";
import type { ContextualMediaRole, ContextualVisualSlot } from "./contextual-media-production-adapter";

export type ContextualPresentationReplacement = { slot: ContextualVisualSlot; role: string; mediaRole: ContextualMediaRole; mediaId: number; url: string; assetSha256: string; altText: string };

export type ResolvedContextualPresentationSlot = {
  role: string;
  requestedSlot: ContextualVisualSlot;
  actualSection: string;
  selector: string;
  placement: "IMAGE" | "BACKGROUND" | "MOUNT_IMAGE";
};

type PresentationProfile = "SAW_REFERENCE" | "LONG_FORM_ARTICLE";

const sawCandidates: Record<ContextualVisualSlot, readonly Omit<ResolvedContextualPresentationSlot, "role" | "requestedSlot">[]> = {
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
    { actualSection: "APPLICATIONS", selector: "[data-reference-section=APPLICATIONS]", placement: "MOUNT_IMAGE" },
  ],
  CTA_ATMOSPHERE: [
    { actualSection: "CTA", selector: "[data-reference-section=CTA]", placement: "BACKGROUND" },
  ],
};

const articleCandidates: Record<ContextualVisualSlot, readonly Omit<ResolvedContextualPresentationSlot, "role" | "requestedSlot">[]> = {
  HERO_EXPERIENCE: [],
  POST_HERO_CONTEXTUAL: [
    { actualSection: "ARTICLE_BODY", selector: "h1 + figure img:first-of-type", placement: "IMAGE" },
    { actualSection: "ARTICLE_BODY", selector: "figure img:first-of-type", placement: "IMAGE" },
    { actualSection: "ARTICLE_BODY", selector: "img:first-of-type", placement: "IMAGE" },
  ],
  APPLICATION_STAGE: [],
  CTA_ATMOSPHERE: [],
};

function resolvePresentationRoot(contentHtml: string) {
  const $ = load(contentHtml, null, false);
  const sawRoots = $(".saw-page");
  if (sawRoots.length > 1) throw new Error("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");
  if (sawRoots.length === 1) return { $, root: sawRoots.first(), profile: "SAW_REFERENCE" as const };

  const sectionMarkers = $("[data-reference-section]");
  if (sectionMarkers.length > 0) throw new Error("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");

  const h1 = $("h1");
  const images = $("figure img, img");
  const mains = $("main");
  const articles = $("article");
  if (h1.length !== 1 || images.length < 1 || mains.length > 1 || articles.length > 1) {
    throw new Error("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");
  }

  if (articles.length === 1) return { $, root: articles.first(), profile: "LONG_FORM_ARTICLE" as const };
  if (mains.length === 1) return { $, root: mains.first(), profile: "LONG_FORM_ARTICLE" as const };
  return { $, root: $.root(), profile: "LONG_FORM_ARTICLE" as const };
}

function candidatesFor(profile: PresentationProfile, slot: ContextualVisualSlot) {
  return profile === "SAW_REFERENCE" ? sawCandidates[slot] : articleCandidates[slot];
}

export function resolveContextualPresentationSlots(contentHtml: string, requests: readonly Pick<ContextualPresentationReplacement, "role" | "slot">[]): readonly ResolvedContextualPresentationSlot[] {
  const { root, profile } = resolvePresentationRoot(contentHtml);
  const usedSections = new Set<unknown>();
  return requests.map((request) => {
    const slotCandidates = candidatesFor(profile, request.slot);
    for (const candidate of slotCandidates) {
      const targets = root.find(candidate.selector);
      const section = targets.first().closest("[data-reference-section]");
      if (targets.length !== 1) continue;
      if (profile === "SAW_REFERENCE") {
        if (section.length !== 1 || usedSections.has(section[0])) continue;
        usedSections.add(section[0]);
      }
      return { role: request.role, requestedSlot: request.slot, ...candidate };
    }
    throw new Error(`CONTEXTUAL_MEDIA_PRESENTATION_SLOT_MISSING:${request.slot}`);
  });
}

export function patchContextualPresentationMedia(contentHtml: string, replacements: readonly ContextualPresentationReplacement[]): string {
  const { $, root } = resolvePresentationRoot(contentHtml);
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
    if (placement.placement === "MOUNT_IMAGE") {
      target.prepend($("<figure>").addClass("saw-generated-application-media").attr("data-contextual-role", replacement.role).append($("<img>").attr("src", replacement.url).attr("alt", replacement.altText).attr("style", "display:block;width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;").attr("data-media-id", String(replacement.mediaId)).attr("data-media-role", replacement.mediaRole).attr("data-contextual-role", replacement.role).attr("data-generated-asset-sha", replacement.assetSha256)));
      target.attr("data-generated-contextual-media", "true");
      continue;
    }
    target.attr("src", replacement.url).attr("data-media-id", String(replacement.mediaId)).attr("data-media-role", replacement.mediaRole).attr("data-contextual-role", replacement.role).attr("data-generated-asset-sha", replacement.assetSha256);
    target.closest("section").attr("data-generated-contextual-media", "true");
  }
  root.attr("data-media-provenance", "GENESIS_GENERATED_CONTEXTUAL_MEDIA_V1");
  return $.html();
}