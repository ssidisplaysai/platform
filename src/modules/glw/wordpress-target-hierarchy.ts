import "server-only";

import { resolveOrCreateGenesisWordPressHierarchy } from "@/modules/foundation/wordpress-hierarchy-authority";
import type { SiteConfiguration } from "@/modules/foundation/types";
import { getGlwState, type GlwGenerationRequest } from "./page-generation";

export type GlwWordPressTargetHierarchyResolution =
  | {
      ok: true;
      parentId: number | undefined;
      wordpressObjectId: string | null;
    }
  | {
      ok: false;
      errorCode: string;
      errorMessage: string;
    };

export async function resolveGlwWordPressTargetHierarchy(input: {
  request: GlwGenerationRequest;
  site: SiteConfiguration;
}): Promise<GlwWordPressTargetHierarchyResolution> {
  if (input.request.pageType === "general_service") {
    return { ok: true, parentId: undefined, wordpressObjectId: null };
  }

  const state = getGlwState(input.request.stateCode);
  const pathSegments = input.request.canonicalPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const productSlug = pathSegments[0] ?? "";

  if (!state || !productSlug) {
    return {
      ok: false,
      errorCode: "WORDPRESS_HIERARCHY_INVALID_TARGET",
      errorMessage: "Genesis could not derive the canonical product/state hierarchy for this target.",
    };
  }

  const hierarchy = await resolveOrCreateGenesisWordPressHierarchy({
    site: input.site,
    productSlug,
    productTitle: input.request.productTopic,
    stateSlug: state.slug,
    stateTitle: state.name,
  });

  if (!hierarchy.ok) {
    return {
      ok: false,
      errorCode: `WORDPRESS_HIERARCHY_${hierarchy.state.toUpperCase()}`,
      errorMessage: hierarchy.message,
    };
  }

  if (input.request.pageType === "state_service") {
    if (!hierarchy.product.wordpressObjectId || !hierarchy.state.wordpressObjectId) {
      return {
        ok: false,
        errorCode: "WORDPRESS_HIERARCHY_IDENTITY_MISSING",
        errorMessage: "Genesis could not resolve the authoritative WordPress product/state identities.",
      };
    }

    return {
      ok: true,
      parentId: hierarchy.product.wordpressObjectId,
      wordpressObjectId: String(hierarchy.state.wordpressObjectId),
    };
  }

  return {
    ok: true,
    parentId: hierarchy.leafParentId,
    wordpressObjectId: null,
  };
}
