import { parseDocument } from "htmlparser2";

export type SemanticMediaRole = "HERO_MEDIA" | "PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE" | "LOCAL_ATMOSPHERE" | "SUPPORTING_MEDIA" | "THEME_FEATURED_MEDIA" | "UNRESOLVED";
export type MediaDocumentAuthority = "HOST_THEME" | "GOVERNED_COMPOSITION";
export type MediaClaimClass = "CONCEPTUAL" | "DOCUMENTARY" | "UNKNOWN";
export type MediaDuplicationClass = "HOST_DUPLICATION" | "COMPOSITION_ACCIDENTAL_DUPLICATION" | "INTENTIONAL_SEMANTIC_REUSE" | "UNRESOLVED_DUPLICATION";

export type RenderedMediaGeometry = { top: number; bottom: number; left: number; right: number; width: number; height: number; objectFit: string; objectPosition: string };

export type RenderedMediaInstance = {
  instanceId: string;
  mediaSourceIdentity: string;
  attachmentIdOrUrl: string;
  semanticRole: SemanticMediaRole;
  sectionIdentity: string;
  compositionRole: string;
  documentAuthority: "POST_CONTENT_BLOCK_HTML" | "WORDPRESS_TEMPLATE";
  hostOrCompositionAuthority: MediaDocumentAuthority;
  intentionalReuseDeclaration: string | null;
  renderedGeometry: RenderedMediaGeometry | null;
  presentationIdentity: string;
  claimClass: MediaClaimClass;
};

export type IntentionalMediaReuseDeclaration = {
  declarationId: string;
  mediaSourceIdentity: string;
  allowedInstances: Array<{ semanticRole: SemanticMediaRole; sectionIdentity: string; compositionRole: string }>;
  authorityReference: string;
  ownerApproved: boolean;
  claimClass: MediaClaimClass;
  misleadingDocumentaryReuse: boolean;
};

export type MediaDuplicationFinding = {
  mediaSourceIdentity: string;
  classification: MediaDuplicationClass;
  instanceIds: string[];
  pass: boolean;
  reasons: string[];
};

export type SemanticMediaPolicyResult = {
  pass: boolean;
  instances: RenderedMediaInstance[];
  findings: MediaDuplicationFinding[];
  hostDuplicateMediaCount: number;
  intentionalReuseCount: number;
  accidentalDuplicationCount: number;
  unresolvedDuplicationCount: number;
};

type DomNode = { type: string; name?: string; attribs?: Record<string, string>; children?: DomNode[]; parent?: DomNode; data?: string };

function attr(node: DomNode | null, name: string): string {
  return node?.attribs?.[name] ?? "";
}

function classes(node: DomNode | null): string[] {
  return attr(node, "class").split(/\s+/u).filter(Boolean);
}

function hasClass(node: DomNode | null, name: string): boolean {
  return classes(node).includes(name);
}

function ancestors(node: DomNode): DomNode[] {
  const result: DomNode[] = [];
  let current = node.parent;
  while (current) { result.push(current); current = current.parent; }
  return result;
}

function descendants(node: DomNode): DomNode[] {
  return (node.children ?? []).flatMap((child) => [child, ...descendants(child)]);
}

function sectionIdentity(node: DomNode, allSections: DomNode[]): string {
  const section = ancestors(node).find((item) => item.name === "section") ?? null;
  if (!section) return "NO_SECTION";
  const id = attr(section, "id");
  const classIdentity = classes(section).sort().join(".") || "section";
  const composition = ancestors(section).find((item) => hasClass(item, "wr-page")) ?? null;
  const scopedSections = composition ? descendants(composition).filter((item) => item.name === "section") : allSections;
  return id || `${classIdentity}:${scopedSections.indexOf(section)}`;
}

function compositionRole(node: DomNode): string {
  const owner = [node, ...ancestors(node)].find((item) => attr(item, "data-media-role")) ?? null;
  if (owner) return attr(owner, "data-media-role");
  if ([node, ...ancestors(node)].some((item) => hasClass(item, "wr-card"))) return "RELATED_CARD";
  if ([node, ...ancestors(node)].some((item) => hasClass(item, "wp-block-post-featured-image"))) return "THEME_FEATURED";
  return "UNRESOLVED";
}

function semanticRole(role: string): SemanticMediaRole {
  if (role === "PRIMARY_HERO") return "HERO_MEDIA";
  if (role === "CONTEXTUAL_SUPPORT") return "APPLICATION_EXPERIENCE";
  if (role === "RELATED_CARD") return "SUPPORTING_MEDIA";
  if (role === "THEME_FEATURED") return "THEME_FEATURED_MEDIA";
  return "UNRESOLVED";
}

function claimClass(node: DomNode): MediaClaimClass {
  const value = `${attr(node, "alt")} ${attr(node, "title")}`.toLowerCase();
  if (/conceptual|generated visual/u.test(value)) return "CONCEPTUAL";
  if (/documentary|verified project/u.test(value)) return "DOCUMENTARY";
  return "UNKNOWN";
}

export function extractRenderedMediaInstances(input: { html: string; origin: string; geometry?: Record<string, RenderedMediaGeometry> }): RenderedMediaInstance[] {
  const document = parseDocument(input.html) as unknown as DomNode;
  const nodes = descendants(document);
  const sections = nodes.filter((node) => node.name === "section");
  const images = nodes.filter((node) => node.name === "img");
  return images.map((image, index) => {
    const source = new URL(attr(image, "src"), input.origin).toString();
    const chain = [image, ...ancestors(image)];
    const authority: MediaDocumentAuthority = chain.some((node) => hasClass(node, "wr-page")) ? "GOVERNED_COMPOSITION" : "HOST_THEME";
    const role = compositionRole(image);
    const section = sectionIdentity(image, sections);
    const presentation = [image.parent?.name ?? "", classes(image.parent ?? null).sort().join("."), classes(ancestors(image).find((item) => item.name === "section") ?? null).sort().join("."), attr(image, "style")].join("|");
    const instanceId = `media-${index + 1}-${section}-${role}`;
    return { instanceId, mediaSourceIdentity: source, attachmentIdOrUrl: source, semanticRole: semanticRole(role), sectionIdentity: section, compositionRole: role, documentAuthority: authority === "HOST_THEME" ? "WORDPRESS_TEMPLATE" : "POST_CONTENT_BLOCK_HTML", hostOrCompositionAuthority: authority, intentionalReuseDeclaration: null, renderedGeometry: input.geometry?.[instanceId] ?? null, presentationIdentity: presentation, claimClass: claimClass(image) };
  });
}

function declarationMatches(instances: RenderedMediaInstance[], declaration: IntentionalMediaReuseDeclaration): boolean {
  if (!declaration.ownerApproved || declaration.misleadingDocumentaryReuse || !declaration.authorityReference.trim()) return false;
  if (instances.some((instance) => instance.claimClass !== declaration.claimClass)) return false;
  return instances.every((instance) => declaration.allowedInstances.some((allowed) => allowed.semanticRole === instance.semanticRole && allowed.sectionIdentity === instance.sectionIdentity && allowed.compositionRole === instance.compositionRole));
}

export function evaluateSemanticMediaReuse(input: { instances: RenderedMediaInstance[]; declarations: IntentionalMediaReuseDeclaration[] }): SemanticMediaPolicyResult {
  const findings: MediaDuplicationFinding[] = [];
  const groups = new Map<string, RenderedMediaInstance[]>();
  for (const instance of input.instances) groups.set(instance.mediaSourceIdentity, [...(groups.get(instance.mediaSourceIdentity) ?? []), instance]);
  for (const [source, instances] of groups) {
    if (instances.length < 2) continue;
    const reasons: string[] = [];
    let classification: MediaDuplicationClass;
    if (instances.some((instance) => instance.hostOrCompositionAuthority === "HOST_THEME")) {
      classification = "HOST_DUPLICATION";
      reasons.push("A host/theme media instance duplicates another rendered source.");
    } else if (new Set(instances.map((instance) => instance.sectionIdentity)).size !== instances.length || new Set(instances.map((instance) => instance.semanticRole)).size !== instances.length) {
      classification = "COMPOSITION_ACCIDENTAL_DUPLICATION";
      reasons.push("Repeated composition media shares a section or semantic role.");
    } else {
      const declaration = input.declarations.find((candidate) => candidate.mediaSourceIdentity === source);
      const distinctStructure = new Set(instances.map((instance) => instance.presentationIdentity)).size === instances.length;
      const geometries = instances.map((instance) => instance.renderedGeometry);
      const distinctGeometry = geometries.some((geometry) => geometry === null) || new Set(geometries.map((geometry) => geometry ? `${geometry.width}:${geometry.height}:${geometry.objectFit}:${geometry.objectPosition}` : "")).size === instances.length;
      if (!declaration || !declarationMatches(instances, declaration)) {
        classification = "UNRESOLVED_DUPLICATION";
        reasons.push("No complete governed reuse declaration matches every media instance.");
      } else if (!distinctStructure || !distinctGeometry) {
        classification = "COMPOSITION_ACCIDENTAL_DUPLICATION";
        reasons.push("Governed roles are present but rendered presentation is identical.");
      } else {
        classification = "INTENTIONAL_SEMANTIC_REUSE";
        reasons.push(`Governed by ${declaration.authorityReference}.`);
        for (const instance of instances) instance.intentionalReuseDeclaration = declaration.declarationId;
      }
    }
    findings.push({ mediaSourceIdentity: source, classification, instanceIds: instances.map((instance) => instance.instanceId), pass: classification === "INTENTIONAL_SEMANTIC_REUSE", reasons });
  }
  return { pass: findings.every((finding) => finding.pass), instances: input.instances, findings, hostDuplicateMediaCount: findings.filter((finding) => finding.classification === "HOST_DUPLICATION").length, intentionalReuseCount: findings.filter((finding) => finding.classification === "INTENTIONAL_SEMANTIC_REUSE").length, accidentalDuplicationCount: findings.filter((finding) => finding.classification === "COMPOSITION_ACCIDENTAL_DUPLICATION").length, unresolvedDuplicationCount: findings.filter((finding) => finding.classification === "UNRESOLVED_DUPLICATION").length };
}