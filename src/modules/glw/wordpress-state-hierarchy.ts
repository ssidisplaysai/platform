import { GLW_APPLICATION_SITE_ID, GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID } from "./page-execution";
import { getGlwState } from "./page-generation";

export type GlwWordPressStateHierarchy = {
  siteId: string;
  productId: string;
  stateCode: string;
  stateSlug: string;
  wordpressStatePageId: string;
  wordpressStatus: "publish";
  wordpressProductParentId: string;
};

export const GLW_WORDPRESS_STATE_HIERARCHY: readonly GlwWordPressStateHierarchy[] = [
  { siteId: GLW_APPLICATION_SITE_ID, productId: GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID, stateCode: "TX", stateSlug: "texas", wordpressStatePageId: "2563", wordpressStatus: "publish", wordpressProductParentId: "124" },
  { siteId: GLW_APPLICATION_SITE_ID, productId: GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID, stateCode: "CA", stateSlug: "california", wordpressStatePageId: "3315", wordpressStatus: "publish", wordpressProductParentId: "124" },
  { siteId: GLW_APPLICATION_SITE_ID, productId: GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID, stateCode: "FL", stateSlug: "florida", wordpressStatePageId: "3344", wordpressStatus: "publish", wordpressProductParentId: "124" },
  { siteId: GLW_APPLICATION_SITE_ID, productId: GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID, stateCode: "GA", stateSlug: "georgia", wordpressStatePageId: "3345", wordpressStatus: "publish", wordpressProductParentId: "124" },
  { siteId: GLW_APPLICATION_SITE_ID, productId: GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID, stateCode: "IL", stateSlug: "illinois", wordpressStatePageId: "3373", wordpressStatus: "publish", wordpressProductParentId: "124" },
  { siteId: GLW_APPLICATION_SITE_ID, productId: GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID, stateCode: "NY", stateSlug: "new-york", wordpressStatePageId: "3495", wordpressStatus: "publish", wordpressProductParentId: "124" },
  { siteId: GLW_APPLICATION_SITE_ID, productId: GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID, stateCode: "NC", stateSlug: "north-carolina", wordpressStatePageId: "3496", wordpressStatus: "publish", wordpressProductParentId: "124" },
] as const;

export function getGlwWordPressStateHierarchy(input: {
  siteId: string;
  productId: string;
  stateCode: string;
}): GlwWordPressStateHierarchy | null {
  const state = getGlwState(input.stateCode);
  const mapping = GLW_WORDPRESS_STATE_HIERARCHY.find((entry) =>
    entry.siteId === input.siteId
    && entry.productId === input.productId
    && entry.stateCode === input.stateCode);
  if (!mapping || !state || mapping.stateSlug !== state.slug) return null;
  return mapping;
}

export function requireGlwWordPressStateHierarchy(input: {
  siteId: string;
  productId: string;
  stateCode: string;
}): GlwWordPressStateHierarchy {
  const mapping = getGlwWordPressStateHierarchy(input);
  if (!mapping) throw new Error(`Exact GLW WordPress state hierarchy is not certified: ${input.siteId}|${input.productId}|${input.stateCode}`);
  return mapping;
}