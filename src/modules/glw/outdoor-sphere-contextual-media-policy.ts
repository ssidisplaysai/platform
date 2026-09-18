export const OUTDOOR_SPHERE_CAMPAIGN_ID = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview" as const;
export const OUTDOOR_SPHERE_PRODUCT_ID = "prod-outdoor-digital-sphere" as const;
export const OUTDOOR_SPHERE_ORGANIZATION_ID = "led-display-warehouse" as const;
export const OUTDOOR_SPHERE_SITE_ID = "site-led-display-warehouse-production" as const;

export function isOutdoorSphereCampaignScope(input: {
  campaignId: string | null | undefined;
  organizationId: string;
  siteId: string;
}): boolean {
  return input.campaignId === OUTDOOR_SPHERE_CAMPAIGN_ID
    && input.organizationId === OUTDOOR_SPHERE_ORGANIZATION_ID
    && input.siteId === OUTDOOR_SPHERE_SITE_ID;
}

export function requiresGeneratedContextualMediaForOutdoorSphere(input: {
  campaignId: string | null | undefined;
  organizationId: string;
  siteId: string;
  productId: string;
}): boolean {
  return input.campaignId === OUTDOOR_SPHERE_CAMPAIGN_ID
    && input.organizationId === OUTDOOR_SPHERE_ORGANIZATION_ID
    && input.siteId === OUTDOOR_SPHERE_SITE_ID
    && input.productId === OUTDOOR_SPHERE_PRODUCT_ID;
}

export function buildOutdoorSphereGeneratedContextualPrompt(input: {
  stateName: string;
  cityName?: string | null;
}): string {
  const location = [input.cityName?.trim() || "", input.stateName.trim()].filter(Boolean).join(", ");
  return [
    "Photorealistic premium outdoor digital LED sphere installation integrated naturally into a high-end commercial, entertainment, hospitality, public-space, or architectural environment appropriate to the target location.",
    "The sphere must read clearly as a professional LED display with a smooth, nearly seamless illuminated surface.",
    "Minimize visible pixel structure, panel seams, module boundaries, moire, grid artifacts, chunky LED texture, and exaggerated individual diodes.",
    "Preserve believable LED construction and realistic scale.",
    "Use rich dynamic display content, premium architectural lighting, realistic reflections and shadows, strong photographic composition, and convincing physical installation.",
    "Avoid toy-like spheres, obvious CGI appearance, oversized pixels, low-resolution screen texture, floating objects, impossible mounting, text/logos, and generic stock-photo appearance.",
    "Do not imply this is a real completed customer installation; treat as conceptual contextual visualization only.",
    location ? `Target scene location style: ${location}.` : "Target scene location style: United States commercial context.",
  ].join(" ");
}