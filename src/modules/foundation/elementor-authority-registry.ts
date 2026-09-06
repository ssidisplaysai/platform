import { createHash } from "node:crypto";

export const ELEMENTOR_AUTHORITY_REGISTRY_VERSION = "genesis-elementor-authority-v1" as const;

export type ElementorMutationClass = "SEMANTIC_HTML" | "INERT_CERTIFICATION" | "REGISTERED_MEDIA_REFERENCE_REPLACEMENT";

export type RegisteredMediaReplacement = {
  before: string;
  after: string;
  mediaId: number;
  mediaUrl: string;
  altText: string;
};

export type ElementorLeafAuthority = {
  elementId: string;
  widgetType: string;
  leafPath: "settings.html";
  mutationClasses: readonly ElementorMutationClass[];
  maxReplacementBytes: number;
  allowScripts: false;
  allowStyles: false;
  allowMediaMutation: false;
  registeredMediaReplacements?: readonly RegisteredMediaReplacement[];
  semanticPolicy?: {
    allowedTextTags: readonly string[];
    allowedAnchorUnwrapHrefs: readonly string[];
    allowedHrefReplacements: readonly { before: string; after: string }[];
    certificationMarker: string;
    rollbackLeafSha256: string;
  };
};

export type ElementorDocumentAuthority = {
  siteId: string;
  hostname: string;
  wordpressObjectId: number;
  registryVersion: typeof ELEMENTOR_AUTHORITY_REGISTRY_VERSION;
  leaves: readonly ElementorLeafAuthority[];
};

const htmlLeaf = (
  elementId: string,
  mutationClasses: readonly ElementorMutationClass[],
): ElementorLeafAuthority => ({
  elementId,
  widgetType: "html",
  leafPath: "settings.html",
  mutationClasses,
  maxReplacementBytes: 100_000,
  allowScripts: false,
  allowStyles: false,
  allowMediaMutation: false,
});

const defenderSemanticPolicy: NonNullable<ElementorLeafAuthority["semanticPolicy"]> = {
  allowedTextTags: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "td", "th", "span", "strong", "em", "a"],
  allowedAnchorUnwrapHrefs: ["/applications/", "/stadiums-arenas/", "/education/", "/houses-of-worship/", "/museums-exhibits/", "/outdoor-entertainment/", "/trade-shows-events/", "/resources/", "/spec-sheets/", "/cad-files/", "/installation-guides/", "/faq/", "/case-studies/"],
  allowedHrefReplacements: [],
  certificationMarker: "<!-- GENESIS-SEMANTIC-HTML-CERT-12575 -->",
  rollbackLeafSha256: "a7816bf54ece6edee0ed03e9f471f39a4aaf15195daef6141d028dc5684db70b",
};

export const ELEMENTOR_AUTHORITY_REGISTRY: readonly ElementorDocumentAuthority[] = [
  {
    siteId: "site-ssi-projectorenclosure",
    hostname: "projectorenclosure.com",
    wordpressObjectId: 3810,
    registryVersion: ELEMENTOR_AUTHORITY_REGISTRY_VERSION,
    leaves: ["98e1f56", "0ce76cb", "e87d71c", "94e8256"].map((id) =>
      htmlLeaf(id, ["SEMANTIC_HTML", "INERT_CERTIFICATION"]),
    ),
  },
  {
    siteId: "site-ssi-projectorenclosure",
    hostname: "projectorenclosure.com",
    wordpressObjectId: 12575,
    registryVersion: ELEMENTOR_AUTHORITY_REGISTRY_VERSION,
    leaves: [{ ...htmlLeaf("2d677b8", ["SEMANTIC_HTML", "INERT_CERTIFICATION"]), semanticPolicy: defenderSemanticPolicy }],
  },
  {
    siteId: "site-ssi-projectorenclosure",
    hostname: "projectorenclosure.com",
    wordpressObjectId: 12596,
    registryVersion: ELEMENTOR_AUTHORITY_REGISTRY_VERSION,
    leaves: [
      htmlLeaf("bc00420", ["INERT_CERTIFICATION"]),
      {
        ...htmlLeaf("f3694b0", ["REGISTERED_MEDIA_REFERENCE_REPLACEMENT"]),
        allowMediaMutation: true,
        registeredMediaReplacements: [
          { before: 'src="IMG-HERE"\n              alt="Integrator Series Unistrut mounting system"', after: 'src="https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-unistrut-mounting-owner-pdf-page-3.png"\n              alt="Integrator Series top and bottom Unistrut mounting detail"', mediaId: 12997, mediaUrl: "https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-unistrut-mounting-owner-pdf-page-3.png", altText: "Integrator Series top and bottom Unistrut mounting detail" },
          { before: 'src="IMG-HERE"\n              alt="Weather-protected Integrator projector enclosure"', after: 'src="https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-sealed-door-interior-owner-pdf-page-3.png"\n              alt="Integrator Series sealed doorway and insulated interior"', mediaId: 12998, mediaUrl: "https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-sealed-door-interior-owner-pdf-page-3.png", altText: "Integrator Series sealed doorway and insulated interior" },
          { before: 'src="IMG-HERE"\n              alt="Integrator Series vandal-resistant locking system"', after: 'src="https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-lock-owner-pdf-page-3.png"\n              alt="Integrator Series enclosure lock detail"', mediaId: 12999, mediaUrl: "https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-lock-owner-pdf-page-3.png", altText: "Integrator Series enclosure lock detail" },
          { before: 'src="IMG-HERE"\n              alt="Fully insulated Integrator projector enclosure"', after: 'src="https://projectorenclosure.com/wp-content/uploads/2026/06/homeline-1-7-scaled.jpg"\n              alt="XS Integrator and Homeline open interior showing insulation"', mediaId: 11972, mediaUrl: "https://projectorenclosure.com/wp-content/uploads/2026/06/homeline-1-7-scaled.jpg", altText: "XS Integrator and Homeline open interior showing insulation" },
          { before: 'src="IMG-HERE"\n              alt="Integrated adjustable projector shelf"', after: 'src="https://projectorenclosure.com/wp-content/uploads/2026/06/homeline-1-7-scaled.jpg"\n              alt="XS Integrator and Homeline open interior showing projector shelf"', mediaId: 11972, mediaUrl: "https://projectorenclosure.com/wp-content/uploads/2026/06/homeline-1-7-scaled.jpg", altText: "XS Integrator and Homeline open interior showing projector shelf" },
        ],
      },
    ],
  },
  {
    siteId: "site-ssi-projectorenclosure",
    hostname: "projectorenclosure.com",
    wordpressObjectId: 12608,
    registryVersion: ELEMENTOR_AUTHORITY_REGISTRY_VERSION,
    leaves: [htmlLeaf("be422a0", ["INERT_CERTIFICATION"])],
  },
];

export function authorizeElementorLeaf(input: {
  siteId: string;
  hostname: string;
  wordpressObjectId: number;
  elementId: string;
  widgetType: string;
  leafPath: string;
  mutationClass: ElementorMutationClass;
  replacement: string;
}): ElementorLeafAuthority | null {
  const document = ELEMENTOR_AUTHORITY_REGISTRY.find((candidate) =>
    candidate.siteId === input.siteId
    && candidate.hostname === input.hostname.replace(/^www\./, "").toLowerCase()
    && candidate.wordpressObjectId === input.wordpressObjectId,
  );
  const leaf = document?.leaves.find((candidate) =>
    candidate.elementId === input.elementId
    && candidate.widgetType === input.widgetType
    && candidate.leafPath === input.leafPath
    && candidate.mutationClasses.includes(input.mutationClass),
  );
  if (!leaf || Buffer.byteLength(input.replacement, "utf8") > leaf.maxReplacementBytes) return null;
  return leaf;
}

function regions(value: string, pattern: RegExp): string[] {
  return [...value.matchAll(pattern)].map((match) => match[0]);
}

export function preservesProtectedElementorRegions(input: {
  authority: ElementorLeafAuthority;
  before: string;
  replacement: string;
}): boolean {
  if (!input.authority.allowScripts && JSON.stringify(regions(input.before, /<script\b[\s\S]*?<\/script>/gi)) !== JSON.stringify(regions(input.replacement, /<script\b[\s\S]*?<\/script>/gi))) return false;
  if (!input.authority.allowStyles && JSON.stringify(regions(input.before, /<style\b[\s\S]*?<\/style>/gi)) !== JSON.stringify(regions(input.replacement, /<style\b[\s\S]*?<\/style>/gi))) return false;
  if (!input.authority.allowMediaMutation && JSON.stringify(regions(input.before, /<(?:img|video|audio|source|picture)\b[^>]*>/gi)) !== JSON.stringify(regions(input.replacement, /<(?:img|video|audio|source|picture)\b[^>]*>/gi))) return false;
  return true;
}

export function applyRegisteredMediaReplacements(authority: ElementorLeafAuthority, value: string, action: "apply" | "rollback"): string {
  if (!authority.mutationClasses.includes("REGISTERED_MEDIA_REFERENCE_REPLACEMENT") || authority.registeredMediaReplacements?.length !== 5) throw new Error("REGISTERED_MEDIA_AUTHORITY_REQUIRED");
  let result = value;
  for (const replacement of authority.registeredMediaReplacements) {
    const source = action === "apply" ? replacement.before : replacement.after;
    const destination = action === "apply" ? replacement.after : replacement.before;
    if (result.split(source).length - 1 !== 1 || result.includes(destination)) throw new Error("REGISTERED_MEDIA_REGION_MISMATCH");
    result = result.replace(source, destination);
  }
  return result;
}

function normalizeSemanticHtml(value: string, authority: ElementorLeafAuthority, reason: "certification" | "remediation" | "rollback"): string | null {
  const policy = authority.semanticPolicy;
  if (!policy) return null;
  let normalized = value.replace(/<!--([\s\S]*?)-->/g, (comment, body: string) => {
    if (comment === policy.certificationMarker && (reason === "certification" || reason === "rollback")) return "";
    return `<!--${body}-->`;
  });
  for (const href of policy.allowedAnchorUnwrapHrefs) {
    const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(new RegExp(`<a\\b([^>]*)href=(["'])${escaped}\\2([^>]*)>([\\s\\S]*?)<\\/a>`, "gi"), "$4");
  }
  for (const replacement of policy.allowedHrefReplacements) normalized = normalized.split(replacement.before).join("__GENESIS_REGISTERED_HREF__").split(replacement.after).join("__GENESIS_REGISTERED_HREF__");
  let denied = false;
  normalized = normalized.replace(/<([a-z][a-z0-9:-]*)\b([^>]*)>/gi, (tag, name: string, attributes: string) => {
    const lower = name.toLowerCase();
    if (/^(?:script|style|img|video|audio|source|picture|iframe|form|input|button|select|textarea)$/.test(lower)) return tag;
    if (/\bon[a-z]+\s*=|\bsrcdoc\s*=|\bdata-code\s*=/i.test(attributes)) denied = true;
    const normalizedAttributes = attributes.replace(/\s+/g, " ").trim();
    return `<${lower}${normalizedAttributes ? ` ${normalizedAttributes}` : ""}>`;
  });
  if (denied) return null;
  const allowed = new Set(policy.allowedTextTags);
  const stack: string[] = [];
  normalized = normalized.replace(/<\/?([a-z][a-z0-9:-]*)\b[^>]*>|([^<]+)/gi, (token, name: string | undefined, text: string | undefined) => {
    if (name) {
      const lower = name.toLowerCase();
      if (token.startsWith("</")) stack.pop(); else if (!token.endsWith("/>") && !/^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/.test(lower)) stack.push(lower);
      return token;
    }
    return allowed.has(stack.at(-1) ?? "") && text?.trim() ? "__GENESIS_TEXT__" : token;
  });
  return normalized;
}

export function permitsSemanticHtmlReplacement(input: { authority: ElementorLeafAuthority; before: string; replacement: string; reason: "certification" | "remediation" | "rollback" }): boolean {
  if (!input.authority.mutationClasses.includes("SEMANTIC_HTML") || !preservesProtectedElementorRegions(input)) return false;
  const policy = input.authority.semanticPolicy;
  if (!policy) return false;
  const markerCount = (value: string) => value.split(policy.certificationMarker).length - 1;
  if (input.reason === "certification" && markerCount(input.replacement) !== markerCount(input.before) + 1) return false;
  if (input.reason === "rollback" && (markerCount(input.replacement) !== markerCount(input.before) - 1 || createHash("sha256").update(input.replacement).digest("hex") !== policy.rollbackLeafSha256)) return false;
  if (input.reason === "remediation" && markerCount(input.replacement) !== markerCount(input.before)) return false;
  for (const href of policy.allowedAnchorUnwrapHrefs) {
    const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (value: string) => (value.match(new RegExp(`<a\\b[^>]*href=["']${escaped}["']`, "gi")) ?? []).length;
    if (count(input.replacement) > count(input.before)) return false;
    const beforeChildren = [...input.before.matchAll(new RegExp(`<a\\b[^>]*href=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/a>`, "gi"))].map((match) => match[1]);
    if (count(input.replacement) < count(input.before) && beforeChildren.some((child) => !input.replacement.includes(child))) return false;
  }
  const before = normalizeSemanticHtml(input.before, input.authority, input.reason);
  const after = normalizeSemanticHtml(input.replacement, input.authority, input.reason);
  return before !== null && before === after;
}