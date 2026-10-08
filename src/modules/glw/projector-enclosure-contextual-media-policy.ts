import type { ContextualVisualPlanItem } from "./contextual-media-production-adapter";
import { SSI_FAN_COOLED_PROJECTOR_PRODUCT_ID } from "./projector-enclosure-rich-assembly";

export const PROJECTOR_ENCLOSURE_CONTEXTUAL_MEDIA_POLICY_VERSION =
  "PROJECTOR_ENCLOSURE_CONTEXTUAL_MEDIA_V2" as const;

export function requiresGeneratedContextualMediaForProjectorEnclosure(input: {
  organizationId: string;
  siteId: string;
  productId: string;
}): boolean {
  return input.organizationId === "ssi"
    && input.siteId === "site-ssi-projectorenclosure"
    && input.productId === SSI_FAN_COOLED_PROJECTOR_PRODUCT_ID;
}

function locationLabel(input: { stateName: string; cityName?: string | null }): string {
  return [input.cityName?.trim() || "", input.stateName.trim()].filter(Boolean).join(", ");
}

function locationQualifier(input: { stateName: string; cityName?: string | null }): string {
  const location = locationLabel(input);
  return location
    ? `Use ${location} only as broad geographic atmosphere. Do not show recognizable landmarks or imply a real local customer installation.`
    : "Use a plausible U.S. commercial setting without implying a real customer installation.";
}

export function buildProjectorEnclosureGeneratedContextualPlan(input: {
  stateName: string;
  cityName?: string | null;
}): readonly ContextualVisualPlanItem[] {
  const location = locationLabel(input);
  const qualifier = locationQualifier(input);

  return [
    {
      role: "CONTEXTUAL_IN_USE",
      mediaRole: "CONTEXTUAL_IN_USE",
      slot: "HERO_EXPERIENCE",
      prompt: [
        "Create a photorealistic commercial projection experience for a ProjectorEnclosure.com landing page.",
        "Show architectural projection mapping at dusk or night on a building facade or large exterior surface.",
        "The projected experience is the hero. Keep projector hardware and any protective enclosure secondary, small, and naturally integrated into the scene.",
        "Use realistic projector throw geometry, plausible mounting, professional AV staging, and strong visual depth.",
        "Do not show readable text, logos, watermarks, fake signage, or identifiable customer branding.",
        "Do not invent product specifications or present generated enclosure details as documentary product evidence.",
        qualifier,
      ].join(" "),
      altText: location
        ? `Conceptual projection mapping experience in ${location}; generated application visualization, not a real customer installation.`
        : "Conceptual projection mapping experience; generated application visualization, not a real customer installation.",
    },
    {
      role: "OUTDOOR_MAPPING_EXPERIENCE",
      mediaRole: "APPLICATION_EXPERIENCE",
      slot: "POST_HERO_CONTEXTUAL",
      prompt: [
        "Create a distinct photorealistic outdoor projection-mapping application scene for a commercial AV planning page.",
        "Show a mapped architectural surface with visible building geometry, realistic projected light, and an audience-scale viewpoint.",
        "Keep any projector enclosure subtle and secondary to the projected experience.",
        "Do not reuse the same composition as the hero image. Use a different camera angle and environment.",
        "No readable text, logos, watermarks, fake customer branding, or unsupported product claims.",
        qualifier,
      ].join(" "),
      altText: location
        ? `Conceptual outdoor projection-mapping application in ${location}; generated planning visualization.`
        : "Conceptual outdoor projection-mapping application; generated planning visualization.",
    },
    {
      role: "OUTDOOR_THEATER_HOSPITALITY",
      mediaRole: "APPLICATION_EXPERIENCE",
      slot: "APPLICATION_STAGE",
      prompt: [
        "Create a photorealistic outdoor hospitality or outdoor-theater projection environment.",
        "Show a premium courtyard, resort patio, rooftop, venue terrace, or similar commercial hospitality setting with a projected cinematic image on a proper viewing surface.",
        "Make the guest experience and projection the focal point. Keep projector protection hardware secondary and unobtrusive.",
        "Use realistic nighttime lighting and plausible projector geometry.",
        "Do not reuse the mapping composition. No readable text, logos, watermarks, customer names, or unsupported product claims.",
        qualifier,
      ].join(" "),
      altText: location
        ? `Conceptual outdoor theater and hospitality projection setting in ${location}; generated planning visualization.`
        : "Conceptual outdoor theater and hospitality projection setting; generated planning visualization.",
    },
    {
      role: "OUTDOOR_COMMERCIAL_EVENT",
      mediaRole: "LOCAL_CONTEXTUAL_ATMOSPHERE",
      slot: "CTA_ATMOSPHERE",
      prompt: [
        "Create a photorealistic commercial event projection environment for a professional AV landing page.",
        "Show a branded-experience style event, museum exterior, venue activation, or temporary commercial projection scene without any readable branding.",
        "The projected content and audience environment should dominate the composition; projector enclosure hardware should remain secondary.",
        "Use a composition clearly different from the hero, mapping, and hospitality images.",
        "No readable text, logos, watermarks, customer names, or unsupported product claims.",
        qualifier,
      ].join(" "),
      altText: location
        ? `Conceptual commercial event projection environment in ${location}; generated planning visualization.`
        : "Conceptual commercial event projection environment; generated planning visualization.",
    },
  ];
}
