import { getProductById } from "@/modules/foundation/product-repository";
import type { ProductConfiguration } from "@/modules/foundation/types";

import {
  createGlwCanonicalPath,
  getGlwState,
  type GlwState,
} from "./page-generation";

export type GlwInternalLinkAuthorityClass =
  | "product"
  | "geography";

export type GlwInternalLinkAuthorityEntry = {
  href: string;
  anchorText: string;
  authorityClass: GlwInternalLinkAuthorityClass;
};

export type GlwInternalGeographyRouteAuthority = {
  organizationId: string;
  siteId: string;
  productId: string;
  stateCode: string;
  href: string;
  anchorText: string;
};

export type GlwInternalLinkAuthorityRequest = {
  organizationId: string;
  siteId: string;
  productId: string;
  stateCode: string;
  canonicalPath: string;
};

export const GLW_INTERNAL_GEOGRAPHY_ROUTE_AUTHORITY:
  readonly GlwInternalGeographyRouteAuthority[] = [];

type Dependencies = {
  getProduct: (productId: string) => ProductConfiguration | null;
  getState: (stateCode: string) => GlwState | null;
  geographyRoutes: readonly GlwInternalGeographyRouteAuthority[];
};

function toSiteRelativePath(value: string): string | null {
  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/")
    || trimmed.startsWith("//")
    || trimmed.includes("://")
  ) {
    return null;
  }

  const path = `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
  return path === "//" ? "/" : path;
}

function productPath(productSlug: string): string {
  return `/${createGlwCanonicalPath({ productSlug })}/`;
}

function statePath(
  productSlug: string,
  stateCode: string,
): string | null {
  const state = getGlwState(stateCode);
  if (!state) return null;
  return `/${createGlwCanonicalPath({
    productSlug,
    stateCode: state.code,
  })}/`;
}

function productAssignment(
  product: ProductConfiguration,
  siteId: string,
) {
  return product.siteAssignments.find(
    (assignment) => assignment.siteId === siteId,
  ) ?? null;
}

function resolveProductLink(input: {
  request: GlwInternalLinkAuthorityRequest;
  product: ProductConfiguration;
}): GlwInternalLinkAuthorityEntry | null {
  const { request, product } = input;
  if (
    product.organizationId !== request.organizationId
    || !product.assignedSiteIds.includes(request.siteId)
  ) {
    return null;
  }

  const assignment = productAssignment(product, request.siteId);
  const slug = assignment?.siteSpecificSlug ?? product.slug;
  const href = toSiteRelativePath(productPath(slug));
  if (!href) return null;

  return {
    href,
    anchorText:
      assignment?.siteSpecificDisplayName
      ?? product.displayName
      ?? product.productName,
    authorityClass: "product",
  };
}

function resolveGeographyLinks(input: {
  request: GlwInternalLinkAuthorityRequest;
  product: ProductConfiguration;
  routes: readonly GlwInternalGeographyRouteAuthority[];
}): readonly GlwInternalLinkAuthorityEntry[] {
  const stateCode = input.request.stateCode.trim().toUpperCase();
  const currentPath = toSiteRelativePath(input.request.canonicalPath);

  return input.routes
    .filter((route) =>
      route.organizationId === input.request.organizationId
      && route.siteId === input.request.siteId
      && route.productId === input.request.productId
      && route.stateCode.trim().toUpperCase() === stateCode,
    )
    .map((route) => {
      const href = toSiteRelativePath(route.href);
      return href
        ? {
            href,
            anchorText: route.anchorText.trim(),
            authorityClass: "geography" as const,
          }
        : null;
    })
    .filter(
      (entry): entry is GlwInternalLinkAuthorityEntry =>
        Boolean(entry?.anchorText)
        && entry?.href !== currentPath,
    );
}

export function resolveGlwAllowedInternalLinks(
  request: GlwInternalLinkAuthorityRequest,
  dependencies?: Partial<Dependencies>,
): readonly GlwInternalLinkAuthorityEntry[] {
  const getProduct = dependencies?.getProduct ?? getProductById;
  const getState = dependencies?.getState ?? getGlwState;
  const geographyRoutes =
    dependencies?.geographyRoutes
    ?? GLW_INTERNAL_GEOGRAPHY_ROUTE_AUTHORITY;

  const stateCode = request.stateCode.trim().toUpperCase();
  const state = getState(stateCode);
  const product = getProduct(request.productId);
  if (!state || !product) return [];

  const assignment = productAssignment(product, request.siteId);
  const slug = assignment?.siteSpecificSlug ?? product.slug;
  const expectedStatePath = statePath(slug, state.code);
  const normalizedCanonicalPath =
    toSiteRelativePath(request.canonicalPath);

  if (
    !expectedStatePath
    || !normalizedCanonicalPath
    || normalizedCanonicalPath !== expectedStatePath
  ) {
    return [];
  }

  const candidates: GlwInternalLinkAuthorityEntry[] = [];
  const productLink = resolveProductLink({ request, product });
  if (productLink) candidates.push(productLink);
  candidates.push(
    ...resolveGeographyLinks({
      request,
      product,
      routes: geographyRoutes,
    }),
  );

  const deduplicated = new Map<
    string,
    GlwInternalLinkAuthorityEntry
  >();
  for (const candidate of candidates) {
    if (!deduplicated.has(candidate.href)) {
      deduplicated.set(candidate.href, candidate);
    }
  }

  return Array.from(deduplicated.values()).sort((a, b) => {
    const classOrder =
      a.authorityClass.localeCompare(b.authorityClass);
    return classOrder || a.href.localeCompare(b.href);
  });
}
