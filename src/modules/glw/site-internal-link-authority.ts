import "server-only";

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

const GLW_LED_DISPLAY_WAREHOUSE_ORGANIZATION_ID =
  "led-display-warehouse";
const GLW_LED_DISPLAY_WAREHOUSE_SITE_ID =
  "site-led-display-warehouse-production";
const GLW_INDOOR_DIGITAL_SPHERE_PRODUCT_ID =
  "prod-indoor-digital-sphere";
const GLW_INDOOR_DIGITAL_SPHERE_PRODUCT_PATH =
  "/indoor-digital-sphere/";

const INDOOR_DIGITAL_SPHERE_PRODUCT_LINK:
  GlwAllowedInternalLink = {
    href: GLW_INDOOR_DIGITAL_SPHERE_PRODUCT_PATH,
    anchorText: "Indoor Digital Sphere",
    authorityClass: "product",
  };

function isStateServiceChildPath(
  canonicalPath: string,
): boolean {
  if (
    canonicalPath
      === GLW_INDOOR_DIGITAL_SPHERE_PRODUCT_PATH
  ) {
    return false;
  }

  if (
    !canonicalPath.startsWith(
      GLW_INDOOR_DIGITAL_SPHERE_PRODUCT_PATH,
    )
  ) {
    return false;
  }

  const remainder = canonicalPath.slice(
    GLW_INDOOR_DIGITAL_SPHERE_PRODUCT_PATH.length,
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

  if (
    input.organizationId
      !== GLW_LED_DISPLAY_WAREHOUSE_ORGANIZATION_ID
    || input.siteId
      !== GLW_LED_DISPLAY_WAREHOUSE_SITE_ID
    || input.productId
      !== GLW_INDOOR_DIGITAL_SPHERE_PRODUCT_ID
    || !/^[A-Z]{2}$/.test(stateCode)
    || !isStateServiceChildPath(
      input.canonicalPath,
    )
  ) {
    return [];
  }

  return [
    { ...INDOOR_DIGITAL_SPHERE_PRODUCT_LINK },
  ];
}
