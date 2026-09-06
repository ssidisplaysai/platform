export const VISUAL_PRODUCT_AUTHORITY_VERSION = "genesis-visual-product-authority-v1" as const;

export type VisualClassification = "EXACT_PRODUCT_IMAGE" | "VERIFIED_PRODUCT_RENDER" | "VERIFIED_PRODUCT_CONTEXT_IMAGE" | "VERIFIED_PRODUCT_DETAIL_IMAGE" | "GENERATED_PRODUCT_CONTEXT_IMAGE" | "GENERIC_CATEGORY_IMAGE" | "LEGACY_UNVERIFIED_PRODUCT_IMAGE" | "COMPETITOR_OR_NON_SSI_PRODUCT_IMAGE" | "DECORATIVE_NON_PRODUCT_IMAGE";
export type VisualSourceRole = "SSI_OWNED_PRODUCT_AUTHORITY" | "SSI_OWNED_INSTALLATION_EVIDENCE" | "OWNER_SUPPLIED_PRODUCT_AUTHORITY" | "FACTORY_OR_MANUFACTURER_PRODUCT_AUTHORITY" | "SSI_SOCIAL_INSTALLATION_EVIDENCE" | "GENERAL_ENVIRONMENT_RESEARCH" | "COMPETITOR_ENVIRONMENT_RESEARCH" | "DISCOVERY_ONLY_VISUAL";
export type LegacyVisualAuditResult = "MATCH" | "PLAUSIBLE_BUT_UNVERIFIED" | "GENERIC_ACCEPTABLE" | "PRODUCT_MISMATCH" | "RESEARCH_REQUIRED";

export type VisualAuthorityReference = {
  referenceId: string;
  sourceRole: VisualSourceRole;
  classification: VisualClassification;
  owner: string | null;
  productId: string | null;
  productFamily: string | null;
  view: string | null;
  installationContext: string | null;
  establishesGeometry: boolean;
  establishesFeatures: boolean;
  environmentOnly: boolean;
  generationReferenceAllowed: boolean;
  namedProductRepresentationAllowed: boolean;
  verificationStatus: "VERIFIED" | "UNVERIFIED" | "REJECTED";
  sourceUrl: string | null;
  durableSourceId: string;
  wordpressMediaId: number | null;
  lineage: readonly string[];
};

export type ProductVisualIdentityPackage = {
  productId: string;
  references: readonly VisualAuthorityReference[];
  requiredViews: readonly string[];
  missingViews: readonly string[];
};

export type GenerationReferenceManifest = {
  productId: string;
  productReferences: readonly string[];
  installationReferences: readonly string[];
  environmentReferences: readonly string[];
  permittedTransformations: readonly ("CONTEXTUAL_PLACEMENT" | "LIGHTING" | "SUPPORTED_VIEWING_ANGLE" | "APPROVED_FINISH_OR_WRAP")[];
  prohibitedInferences: readonly string[];
};

const productTruthRoles = new Set<VisualSourceRole>(["SSI_OWNED_PRODUCT_AUTHORITY", "OWNER_SUPPLIED_PRODUCT_AUTHORITY", "FACTORY_OR_MANUFACTURER_PRODUCT_AUTHORITY"]);

export function canEstablishProductTruth(reference: VisualAuthorityReference): boolean {
  return reference.verificationStatus === "VERIFIED" && productTruthRoles.has(reference.sourceRole) && !reference.environmentOnly;
}

export function canRepresentNamedProduct(reference: VisualAuthorityReference, productId: string): boolean {
  return reference.productId === productId && reference.namedProductRepresentationAllowed && canEstablishProductTruth(reference) && !["GENERIC_CATEGORY_IMAGE", "LEGACY_UNVERIFIED_PRODUCT_IMAGE", "COMPETITOR_OR_NON_SSI_PRODUCT_IMAGE"].includes(reference.classification);
}

export function validateGenerationReferenceManifest(manifest: GenerationReferenceManifest, references: readonly VisualAuthorityReference[]): readonly string[] {
  const byId = new Map(references.map((reference) => [reference.referenceId, reference]));
  const issues: string[] = [];
  if (!manifest.productReferences.length) issues.push("PRODUCT_VISUAL_AUTHORITY_MISSING");
  for (const id of manifest.productReferences) if (!byId.has(id) || !canRepresentNamedProduct(byId.get(id)!, manifest.productId)) issues.push(`INVALID_PRODUCT_REFERENCE:${id}`);
  for (const id of manifest.environmentReferences) if (!byId.has(id) || !byId.get(id)!.environmentOnly) issues.push(`INVALID_ENVIRONMENT_REFERENCE:${id}`);
  const requiredProhibitions = ["new vents", "new locks", "new doors", "new dimensions", "new weather seals", "new controls", "new mounting systems", "unsupported physical features"];
  for (const prohibition of requiredProhibitions) if (!manifest.prohibitedInferences.includes(prohibition)) issues.push(`MISSING_PROHIBITION:${prohibition}`);
  return issues;
}

export function auditLegacyProductImage(input: { namedProductId: string | null; reference: VisualAuthorityReference | null; genericPage: boolean }): LegacyVisualAuditResult {
  if (!input.reference) return "RESEARCH_REQUIRED";
  if (input.namedProductId && canRepresentNamedProduct(input.reference, input.namedProductId)) return "MATCH";
  if (input.namedProductId && input.reference.productId && input.reference.productId !== input.namedProductId) return "PRODUCT_MISMATCH";
  if (!input.namedProductId && input.genericPage && input.reference.classification === "GENERIC_CATEGORY_IMAGE") return "GENERIC_ACCEPTABLE";
  if (input.reference.verificationStatus === "UNVERIFIED") return "PLAUSIBLE_BUT_UNVERIFIED";
  return "RESEARCH_REQUIRED";
}

export const AUTONOMOUS_IMAGE_REPLACEMENT_ENABLED = false as const;