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
