import type { VisualAuthorityReference } from "./visual-product-authority";

export const INTEGRATOR_AUTHORITY_VERSION = "projectorenclosure-integrator-owner-authority-v1" as const;
export const INTEGRATOR_FAMILY_ID = "family-ssi-integrator-series" as const;
export const INTEGRATOR_PRODUCT_AUTHORITY_ID = "prod-ssi-integrator-series-projector-enclosure" as const;
export const HOMELINE_PRODUCT_ID = "prod-ssi-homeline-projector-enclosure" as const;

export const INTEGRATOR_SOURCE_DOCUMENTS = Object.freeze({
  xs: {
    id: "owner-pdf:xs-integrator-overview-specifications",
    path: "resources/product-authority/projectorenclosure/integrator/source-documents/XS - Integrator Projector Enclosure Overview & Specifications.pdf",
    sha256: "56e60725e53b152474ed7deb1ee63babaf171229fde310ba35a557b976387c37",
    authorityType: "OWNER_SUPPLIED_SSI_FIRST_PARTY",
  },
  family2025: {
    id: "owner-pdf:2025-integrator-overview-specifications",
    path: "resources/product-authority/projectorenclosure/integrator/source-documents/2025 Integrator Overview and Specifications (1).pdf",
    sha256: "9f92b0b583415e9e3a98278dc597264802603555253ea265a8c0577bb78dc5f6",
    authorityType: "OWNER_SUPPLIED_SSI_FIRST_PARTY",
  },
} as const);

export const XS_INTEGRATOR_HOMELINE_RELATIONSHIP = Object.freeze({
  relationshipId: "owner-confirmed-xs-integrator-homeline-v1",
  relationshipType: "MARKET_IDENTITY_ALIAS",
  canonicalProductId: HOMELINE_PRODUCT_ID,
  parentFamilyId: INTEGRATOR_FAMILY_ID,
  memberIdentity: "XS Integrator",
  aliases: ["Homeline", "XS Integrator", "Extra Small Integrator", "ENC-FC-XS"] as const,
  ownerConfirmed: true,
  supportingEvidence: [
    "owner-confirmation:xs-integrator-equals-homeline",
    `${INTEGRATOR_SOURCE_DOCUMENTS.xs.id}:page:1`,
    `${INTEGRATOR_SOURCE_DOCUMENTS.family2025.id}:page:5`,
  ] as const,
  exclusions: ["Small Integrator", "Medium Integrator", "Large Integrator", "Custom Integrator"] as const,
});

export function resolveIntegratorIdentity(value: string): { productId: string; familyId: string; scope: "XS_INTEGRATOR_HOMELINE" } | null {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const aliases = XS_INTEGRATOR_HOMELINE_RELATIONSHIP.aliases.map((alias) => alias.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
  return aliases.includes(normalized) ? { productId: HOMELINE_PRODUCT_ID, familyId: INTEGRATOR_FAMILY_ID, scope: "XS_INTEGRATOR_HOMELINE" } : null;
}

export type IntegratorFactScope = "INTEGRATOR_FAMILY" | "XS_INTEGRATOR_HOMELINE" | "SMALL" | "MEDIUM" | "LARGE";
export type IntegratorAuthorityFact = { key: string; value: string; scope: IntegratorFactScope; source: string; page: number; confidence: 1; applicability: string };
const fact = (key: string, value: string, scope: IntegratorFactScope, documentId: string, page: number, applicability: string): IntegratorAuthorityFact => ({ key, value, scope, source: documentId, page, confidence: 1, applicability });

export const INTEGRATOR_AUTHORITY_FACTS: readonly IntegratorAuthorityFact[] = [
  fact("cooling_method", "fan-cooled", "INTEGRATOR_FAMILY", INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, 2, "Integrator Series"),
  fact("insulation", "fully insulated", "INTEGRATOR_FAMILY", INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, 4, "Integrator Series"),
  fact("mounting_top", "permanent top Unistrut", "INTEGRATOR_FAMILY", INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, 3, "Integrator Series"),
  fact("mounting_bottom", "removable bottom Unistrut", "INTEGRATOR_FAMILY", INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, 3, "Integrator Series"),
  fact("lock", "vandal-resistant locks; designs vary by size", "INTEGRATOR_FAMILY", INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, 3, "Integrator Series, size-specific lock design"),
  fact("projector_shelf", "30-point adjustable-height projector shelf", "INTEGRATOR_FAMILY", INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, 4, "Integrator Series"),
  fact("material", "metal with powder-coat finish; white standard", "INTEGRATOR_FAMILY", INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, 5, "Integrator Series"),
  fact("ip_rating", "IP55 Equivalent", "INTEGRATOR_FAMILY", INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, 5, "Integrator Series; retain qualifier Equivalent"),
  fact("model", "ENC-FC-XS", "XS_INTEGRATOR_HOMELINE", INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, 5, "Extra Small only"),
  fact("dimensions_lwh", "22.6 x 19.69 x 10.83 in", "XS_INTEGRATOR_HOMELINE", INTEGRATOR_SOURCE_DOCUMENTS.xs.id, 1, "XS/Homeline only"),
  fact("usable_space_lwh", "13 x 20 x 7 in", "XS_INTEGRATOR_HOMELINE", INTEGRATOR_SOURCE_DOCUMENTS.xs.id, 1, "XS/Homeline only"),
  fact("power_draw", "110 V, 5 A", "XS_INTEGRATOR_HOMELINE", INTEGRATOR_SOURCE_DOCUMENTS.xs.id, 1, "XS/Homeline only; excludes internal outlets"),
  fact("door_opening_hw", "16.02 x 7.56 in", "XS_INTEGRATOR_HOMELINE", INTEGRATOR_SOURCE_DOCUMENTS.xs.id, 1, "XS/Homeline only"),
  fact("dimensions_lwh", "31 x 28.25 x 14.5 in", "SMALL", INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, 5, "Small ENC-FC-SM only"),
  fact("dimensions_lwh", "39.5 x 29.25 x 28.83 in", "MEDIUM", INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, 5, "Medium ENC-FC-MD only"),
  fact("dimensions_lwh", "43.5 x 34.38 x 18.75 in", "LARGE", INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, 5, "Large ENC-FC-LG only"),
];

export const INTEGRATOR_AUTHORITY_CONFLICTS = Object.freeze([
  {
    conflictId: "integrator-cooling-topology-wording",
    sources: [`${INTEGRATOR_SOURCE_DOCUMENTS.family2025.id}:page:1`, `${INTEGRATOR_SOURCE_DOCUMENTS.family2025.id}:page:2`],
    statement: "The document describes the family as both fan-cooled and closed-loop sealed.",
    policy: "RESOLVED_BY_OWNER_INTEGRATOR_IS_FAN_COOLED",
    controllingValue: "FAN_COOLED",
    resolvedBy: "owner-resolution:integrator-cooling",
  },
] as const);

export const INTEGRATOR_VISUAL_AUTHORITY: readonly VisualAuthorityReference[] = [
  { referenceId: "integrator-owner-pdf-p3-unistrut", sourceRole: "OWNER_SUPPLIED_PRODUCT_AUTHORITY", classification: "VERIFIED_PRODUCT_DETAIL_IMAGE", owner: "ssi", productId: INTEGRATOR_PRODUCT_AUTHORITY_ID, productFamily: INTEGRATOR_FAMILY_ID, view: "top-and-bottom-mounting-detail", installationContext: null, establishesGeometry: false, establishesFeatures: true, environmentOnly: false, generationReferenceAllowed: true, namedProductRepresentationAllowed: true, verificationStatus: "VERIFIED", sourceUrl: "https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-unistrut-mounting-owner-pdf-page-3.png", durableSourceId: `${INTEGRATOR_SOURCE_DOCUMENTS.family2025.id}:page:3:image:1:sha256:6fd6a066fabdda02e6a84a7a39d69ae3d2dce244d027702e58f6120287579865`, wordpressMediaId: 12997, lineage: [INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, "page:3", "embedded-image:1", "rotation-normalized:90", "wordpress-media:12997", "upload-byte-identical"] },
  { referenceId: "integrator-owner-pdf-p3-sealed-door", sourceRole: "OWNER_SUPPLIED_PRODUCT_AUTHORITY", classification: "VERIFIED_PRODUCT_DETAIL_IMAGE", owner: "ssi", productId: INTEGRATOR_PRODUCT_AUTHORITY_ID, productFamily: INTEGRATOR_FAMILY_ID, view: "sealed-door-and-interior-detail", installationContext: null, establishesGeometry: true, establishesFeatures: true, environmentOnly: false, generationReferenceAllowed: true, namedProductRepresentationAllowed: true, verificationStatus: "VERIFIED", sourceUrl: "https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-sealed-door-interior-owner-pdf-page-3.png", durableSourceId: `${INTEGRATOR_SOURCE_DOCUMENTS.family2025.id}:page:3:image:2:sha256:ba3ff2dea08b7b192919199f270a8aa6da3ecaea2a01af36f601d4e1b66e495b`, wordpressMediaId: 12998, lineage: [INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, "page:3", "embedded-image:2", "wordpress-media:12998", "upload-byte-identical"] },
  { referenceId: "integrator-owner-pdf-p3-lock", sourceRole: "OWNER_SUPPLIED_PRODUCT_AUTHORITY", classification: "VERIFIED_PRODUCT_DETAIL_IMAGE", owner: "ssi", productId: INTEGRATOR_PRODUCT_AUTHORITY_ID, productFamily: INTEGRATOR_FAMILY_ID, view: "lock-detail", installationContext: null, establishesGeometry: false, establishesFeatures: true, environmentOnly: false, generationReferenceAllowed: true, namedProductRepresentationAllowed: true, verificationStatus: "VERIFIED", sourceUrl: "https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-lock-owner-pdf-page-3.png", durableSourceId: `${INTEGRATOR_SOURCE_DOCUMENTS.family2025.id}:page:3:image:5:sha256:d127ba7ee44882fa4621f4e6dbec187493c3f6c28e25fca97713388a83dd6fe5`, wordpressMediaId: 12999, lineage: [INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, "page:3", "embedded-image:5", "wordpress-media:12999", "upload-byte-identical"] },
  { referenceId: "integrator-owner-pdf-p4-open-interior", sourceRole: "OWNER_SUPPLIED_PRODUCT_AUTHORITY", classification: "VERIFIED_PRODUCT_DETAIL_IMAGE", owner: "ssi", productId: INTEGRATOR_PRODUCT_AUTHORITY_ID, productFamily: INTEGRATOR_FAMILY_ID, view: "open-interior-insulation-and-shelf", installationContext: null, establishesGeometry: true, establishesFeatures: true, environmentOnly: false, generationReferenceAllowed: true, namedProductRepresentationAllowed: true, verificationStatus: "VERIFIED", sourceUrl: null, durableSourceId: `${INTEGRATOR_SOURCE_DOCUMENTS.family2025.id}:page:4:image:1:sha256:ff88d3a3bfb941c4c2ac2fbd5782632751f67239415248d25dee6c117e5778e8`, wordpressMediaId: null, lineage: [INTEGRATOR_SOURCE_DOCUMENTS.family2025.id, "page:4", "embedded-image:1", "corroborates:wordpress-media:11972"] },
  { referenceId: "xs-integrator-homeline-wordpress-11972", sourceRole: "SSI_OWNED_PRODUCT_AUTHORITY", classification: "EXACT_PRODUCT_IMAGE", owner: "ssi", productId: HOMELINE_PRODUCT_ID, productFamily: INTEGRATOR_FAMILY_ID, view: "open-interior", installationContext: null, establishesGeometry: true, establishesFeatures: true, environmentOnly: false, generationReferenceAllowed: true, namedProductRepresentationAllowed: true, verificationStatus: "VERIFIED", sourceUrl: "https://projectorenclosure.com/wp-content/uploads/2026/06/homeline-1-7-scaled.jpg", durableSourceId: "wordpress-media:11972", wordpressMediaId: 11972, lineage: ["owner-confirmation:xs-integrator-equals-homeline", `${INTEGRATOR_SOURCE_DOCUMENTS.family2025.id}:page:4:image:1`] },
];

export const INTEGRATOR_12596_VISUAL_PLAN = Object.freeze([
  { position: "EASY_MOUNTING", role: "Unistrut mounting detail", referenceId: "integrator-owner-pdf-p3-unistrut", status: "CLEARED", wordpressUploadRequired: false },
  { position: "ALL_WEATHER_PROTECTION", role: "sealed doorway and interior construction", referenceId: "integrator-owner-pdf-p3-sealed-door", status: "CLEARED", wordpressUploadRequired: false },
  { position: "SAFE_AND_SECURE", role: "lock and access detail", referenceId: "integrator-owner-pdf-p3-lock", status: "CLEARED", wordpressUploadRequired: false },
  { position: "FULLY_INSULATED", role: "open interior and insulation", referenceId: "xs-integrator-homeline-wordpress-11972", status: "CLEARED", wordpressUploadRequired: false },
  { position: "INTEGRATED_PROJECTOR_SHELF", role: "open interior and shelf configuration", referenceId: "xs-integrator-homeline-wordpress-11972", status: "CLEARED", wordpressUploadRequired: false },
] as const);