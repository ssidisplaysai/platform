import { createHash } from "node:crypto";

export const ELEMENTOR_AUTHORITY_REGISTRY_VERSION = "genesis-elementor-authority-v1" as const;

export type ElementorMutationClass = "SEMANTIC_HTML" | "SEMANTIC_HTML_ATOMIC" | "INERT_CERTIFICATION" | "REGISTERED_MEDIA_REFERENCE_REPLACEMENT";

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
  atomicOnly?: true;
  registeredMediaReplacements?: readonly RegisteredMediaReplacement[];
  semanticPolicy?: {
    allowedTextTags: readonly string[];
    allowedTextReplacements: readonly { before: string; after: string }[];
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
  atomicSemanticAuthority?: {
    mutationClass: "SEMANTIC_HTML_ATOMIC";
    orderedElementIds: readonly string[];
    reasons: readonly ["certification", "remediation", "rollback"];
  };
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

const defenderMainSemanticPolicy: NonNullable<ElementorLeafAuthority["semanticPolicy"]> = {
  allowedTextTags: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "td", "th", "span", "strong", "em", "a"],
  allowedTextReplacements: [],
  allowedAnchorUnwrapHrefs: [],
  allowedHrefReplacements: [],
  certificationMarker: "<!-- GENESIS-SEMANTIC-HTML-CERT-12575 -->",
  rollbackLeafSha256: "a7816bf54ece6edee0ed03e9f471f39a4aaf15195daef6141d028dc5684db70b",
};

const defenderFeaturesSemanticPolicy: NonNullable<ElementorLeafAuthority["semanticPolicy"]> = {
  allowedTextTags: [],
  allowedTextReplacements: [
    { before: "Engineered for Any Environment", after: "Engineered for Project-Specific Environments" },
    { before: "Integrated heating, cooling and evaporation with thermostat control to maintain optimal performance.", after: "Integrated heating, cooling and evaporation with thermostat control for regulated enclosure temperature management." },
    { before: "ENC-AC-SM", after: "ENC-CC-SM" },
    { before: "ENC-AC-MD", after: "ENC-CC-MD" },
    { before: "ENC-AC-LG", after: "ENC-CC-LG" },
    { before: "ENC-AC-LG+", after: "ENC-CC-LG+" },
    { before: "ENC-AC-XL", after: "ENC-CC-XL" },
  ],
  allowedAnchorUnwrapHrefs: [],
  allowedHrefReplacements: [],
  certificationMarker: "<!-- GENESIS-SEMANTIC-HTML-CERT-12575-59B7DE5 -->",
  rollbackLeafSha256: "f493affb8a71b593e32a393a7beec2291b666b19022b4c38a3da2eed27b8b2eb",
};

const defenderNavigationSemanticPolicy: NonNullable<ElementorLeafAuthority["semanticPolicy"]> = {
  allowedTextTags: [],
  allowedTextReplacements: [
    { before: "Weatherproof projector systems for patios, resorts, theaters, parks, and outdoor venues.", after: "Projector enclosure planning for patios, resorts, theaters, parks, and outdoor venues." },
    { before: "Maintains optimal operating temperatures for consistent projection performance.", after: "Supports temperature management for projector installations within model-specific operating requirements." },
  ],
  allowedAnchorUnwrapHrefs: ["/applications/", "/stadiums-arenas/", "/education/", "/houses-of-worship/", "/museums-exhibits/", "/outdoor-entertainment/", "/trade-shows-events/", "/resources/", "/spec-sheets/", "/cad-files/", "/installation-guides/", "/faq/", "/case-studies/"],
  allowedHrefReplacements: [],
  certificationMarker: "<!-- GENESIS-SEMANTIC-HTML-CERT-12575-ACCC44A -->",
  rollbackLeafSha256: "c087df9b11701908fb052e533edfaba10d29b61dde9983a14bc052e69d0a6ee8",
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
    leaves: [
      { ...htmlLeaf("2d677b8", ["SEMANTIC_HTML", "INERT_CERTIFICATION"]), semanticPolicy: defenderMainSemanticPolicy },
      { ...htmlLeaf("59b7de5", ["SEMANTIC_HTML", "INERT_CERTIFICATION"]), atomicOnly: true, semanticPolicy: defenderFeaturesSemanticPolicy },
      { ...htmlLeaf("accc44a", ["SEMANTIC_HTML", "INERT_CERTIFICATION"]), atomicOnly: true, semanticPolicy: defenderNavigationSemanticPolicy },
    ],
    atomicSemanticAuthority: {
      mutationClass: "SEMANTIC_HTML_ATOMIC",
      orderedElementIds: ["2d677b8", "59b7de5", "accc44a"],
      reasons: ["certification", "remediation", "rollback"],
    },
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
    const normalizedText = text?.replace(/\s+/g, " ").trim();
    const registeredTextIndex = normalizedText ? policy.allowedTextReplacements.findIndex((replacement) => normalizedText === replacement.before || normalizedText === replacement.after) : -1;
    if (registeredTextIndex >= 0) return `__GENESIS_REGISTERED_TEXT_${registeredTextIndex}__`;
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
  }
  const before = normalizeSemanticHtml(input.before, input.authority, input.reason);
  const after = normalizeSemanticHtml(input.replacement, input.authority, input.reason);
  return before !== null && before === after;
}

export function permitsAtomicSemanticHtmlReplacement(input: {
  siteId: string;
  hostname: string;
  wordpressObjectId: number;
  mutationClass: string;
  reason: "certification" | "remediation" | "rollback";
  changes: readonly { elementId: string; leafPath: string; before: string; replacement: string }[];
}): boolean {
  const document = ELEMENTOR_AUTHORITY_REGISTRY.find((candidate) =>
    candidate.siteId === input.siteId
    && candidate.hostname === input.hostname.replace(/^www\./, "").toLowerCase()
    && candidate.wordpressObjectId === input.wordpressObjectId,
  );
  const atomic = document?.atomicSemanticAuthority;
  if (!document || !atomic || input.mutationClass !== atomic.mutationClass || !atomic.reasons.includes(input.reason)) return false;
  if (input.changes.length !== atomic.orderedElementIds.length) return false;
  return input.changes.every((change, index) => {
    if (change.elementId !== atomic.orderedElementIds[index] || change.leafPath !== "settings.html") return false;
    const authority = document.leaves.find((leaf) => leaf.elementId === change.elementId && leaf.leafPath === change.leafPath);
    return Boolean(authority)
      && Buffer.byteLength(change.replacement, "utf8") <= authority!.maxReplacementBytes
      && permitsSemanticHtmlReplacement({ authority: authority!, before: change.before, replacement: change.replacement, reason: input.reason });
  });
}