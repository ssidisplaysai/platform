export const ELEMENTOR_AUTHORITY_REGISTRY_VERSION = "genesis-elementor-authority-v1" as const;

export type ElementorMutationClass = "SEMANTIC_HTML" | "INERT_CERTIFICATION";

export type ElementorLeafAuthority = {
  elementId: string;
  widgetType: string;
  leafPath: "settings.html";
  mutationClasses: readonly ElementorMutationClass[];
  maxReplacementBytes: number;
  allowScripts: false;
  allowStyles: false;
  allowMediaMutation: false;
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
    wordpressObjectId: 12596,
    registryVersion: ELEMENTOR_AUTHORITY_REGISTRY_VERSION,
    leaves: [htmlLeaf("bc00420", ["INERT_CERTIFICATION"])],
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