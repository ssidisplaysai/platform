import "server-only";

import { getProductById } from "@/modules/foundation/product-repository";

export type GlwAllowedInternalLink = {
  href: string;
  anchorText: string;
  authorityClass: "product" | "geography";
};

export type GlwInternalLinkAuthorityRequest = {
  organizationId: string;
  siteId: string;
  productId: string;
  stateCode: string;
  canonicalPath: string;
};

function normalizeProductSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveGlwProductAuthority(input: {
  organizationId: string;
  siteId: string;
  productId: string;
}): { path: string; anchorText: string } | null {
  const product = getProductById(input.productId);
  if (!product) return null;
  if (product.organizationId !== input.organizationId) return null;

  const assignment = product.siteAssignments.find((candidate) => candidate.siteId === input.siteId);
  if (!assignment) return null;
  if (!assignment.enabledForSite) return null;
  if (assignment.publicationStatus !== "ready") return null;

  const slug = normalizeProductSlug(assignment.siteSpecificSlug || product.slug || "");
  if (!slug) return null;

  const anchorText =
    assignment.siteSpecificDisplayName?.trim()
    || product.displayName?.trim()
    || product.productName.trim();
  if (!anchorText) return null;

  return {
    path: `/${slug}/`,
    anchorText,
  };
}

function productAuthority(input: GlwInternalLinkAuthorityRequest): { link: GlwAllowedInternalLink; path: string } | null {
  const authority = resolveGlwProductAuthority({
    organizationId: input.organizationId,
    siteId: input.siteId,
    productId: input.productId,
  });
  if (!authority) return null;
  return {
    path: authority.path,
    link: {
      href: authority.path,
      anchorText: authority.anchorText,
      authorityClass: "product",
    },
  };
}

function isStateServiceChildPath(
  canonicalPath: string,
  productPath: string,
): boolean {
  if (
    canonicalPath
      === productPath
  ) {
    return false;
  }

  if (
    !canonicalPath.startsWith(
      productPath,
    )
  ) {
    return false;
  }

  const remainder = canonicalPath.slice(
    productPath.length,
  );

  return /^[a-z0-9-]+\/$/.test(remainder);
}


function escapeGlwLinkHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeGlwAnchorText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function renderGlwAllowedInternalLinks(input: {
  html: string;
  links: readonly GlwAllowedInternalLink[];
}): {
  html: string;
  rendered: readonly GlwAllowedInternalLink[];
} {
  if (input.links.length === 0) {
    return {
      html: input.html,
      rendered: [],
    };
  }

  let html = input.html;
  const rendered: GlwAllowedInternalLink[] = [];

  for (const link of input.links) {
    const requiredAnchor =
      normalizeGlwAnchorText(link.anchorText);

    const anchorPattern =
      /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let alreadyPresent = false;
    let match: RegExpExecArray | null;

    while ((match = anchorPattern.exec(html)) !== null) {
      const href = (match[1] ?? "").trim();
      const anchor =
        normalizeGlwAnchorText(match[2] ?? "");

      if (
        href === link.href
        && anchor === requiredAnchor
      ) {
        alreadyPresent = true;
        break;
      }
    }

    if (alreadyPresent) {
      rendered.push({ ...link });
      continue;
    }

    const sentence =
      `<p>Explore our <a href="${escapeGlwLinkHtml(link.href)}">${escapeGlwLinkHtml(link.anchorText)}</a> solutions for additional product specifications, turnkey package details, and display options.</p>`;

    const firstParagraph =
      html.match(/<p\b[^>]*>[\s\S]*?<\/p>/i);

    if (
      !firstParagraph
      || typeof firstParagraph.index !== "number"
    ) {
      html = `${sentence}\n${html}`;
    } else {
      const end =
        firstParagraph.index
        + firstParagraph[0].length;

      html =
        `${html.slice(0, end)}\n${sentence}${html.slice(end)}`;
    }

    rendered.push({ ...link });
  }

  return {
    html,
    rendered,
  };
}

export function resolveGlwAllowedInternalLinks(
  input: GlwInternalLinkAuthorityRequest,
): readonly GlwAllowedInternalLink[] {
  const stateCode =
    input.stateCode.trim().toUpperCase();
  const authority = productAuthority(input);

  if (
    !authority
    || !/^[A-Z]{2}$/.test(stateCode)
    || !isStateServiceChildPath(
      input.canonicalPath,
      authority.path,
    )
  ) {
    return [];
  }

  return [
    { ...authority.link },
  ];
}
