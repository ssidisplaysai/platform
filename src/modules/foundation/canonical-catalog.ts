import { createHash } from "node:crypto";

import type {
  ProductConfiguration,
  ProductDocumentReferences,
  ProductMediaReferences,
  ProductSpecification,
  ProductSpecificationVisibility,
} from "./types";

export type CanonicalEntityStatus = "draft" | "active" | "suspended" | "archived";
export type AttributeDataType = "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "ENUM" | "DIMENSION";
export type AttributeCardinality = "SINGLE" | "MULTIPLE";
export type AttributeOwnerType = "PRODUCT" | "VARIANT";
export type AttributeVisibility = "PUBLIC" | "INTERNAL";
export type VariantPageEligibility = "UNASSESSED" | "ELIGIBLE" | "NOT_ELIGIBLE" | "BLOCKED";

export type VariantIdentityPolicy = {
  attributeDefinitionIds: readonly string[];
};

export type ProductFamily = {
  productFamilyId: string;
  organizationId: string;
  name: string;
  slug: string;
  status: CanonicalEntityStatus;
  attributeDefinitionIds: readonly string[];
  variantIdentityPolicy: VariantIdentityPolicy;
  version: number;
  legacyIdentifiers?: readonly string[];
};

export type UpdateProductFamilyInput = Partial<
  Omit<ProductFamily, "productFamilyId" | "organizationId">
>;

export type AttributeNormalizationPolicy = {
  trim: boolean;
  caseNormalization: "NONE" | "LOWERCASE" | "UPPERCASE";
  canonicalUnit: string | null;
};

export type AttributeDefinition = {
  attributeDefinitionId: string;
  key: string;
  label: string;
  dataType: AttributeDataType;
  unitDimension: string | null;
  allowedUnits: readonly string[];
  cardinality: AttributeCardinality;
  identityBearing: boolean;
  requiredForVariant: boolean;
  visibility: AttributeVisibility;
  normalizationPolicy: AttributeNormalizationPolicy;
  version: number;
};

export type UpdateAttributeDefinitionInput = Partial<
  Omit<AttributeDefinition, "attributeDefinitionId">
>;

export type AttributeValue = {
  attributeValueId: string;
  ownerType: AttributeOwnerType;
  ownerId: string;
  attributeDefinitionId: string;
  rawValue: string;
  normalizedValue: string | null;
  unit: string | null;
  confidence: number | null;
  sourceProvenanceIds: readonly string[];
  sourceReference: string | null;
  evidenceReference: string | null;
  visibility: AttributeVisibility;
  sortOrder: number;
};

export type ProductVariant = {
  variantId: string;
  productId: string;
  variantKey: string;
  sku: string;
  modelNumber: string | null;
  attributeValues: readonly AttributeValue[];
  status: CanonicalEntityStatus;
  pageEligibility: VariantPageEligibility;
  version: number;
};

export type UpdateProductVariantInput = Partial<
  Omit<ProductVariant, "variantId" | "productId" | "variantKey">
>;

export type MediaAssetType = "IMAGE" | "VIDEO" | "OTHER";
export type DocumentAssetType =
  | "TECHNICAL_DRAWING"
  | "SPEC_SHEET"
  | "BROCHURE"
  | "MANUAL"
  | "INSTALLATION_GUIDE"
  | "WARRANTY"
  | "OTHER";
export type AssetStatus = "REFERENCE_ONLY" | "ACTIVE" | "UNAVAILABLE" | "ARCHIVED";

export type MediaAsset = {
  mediaAssetId: string;
  organizationId: string;
  type: MediaAssetType;
  uri: string;
  contentHash: string | null;
  mimeType: string | null;
  metadata: Readonly<Record<string, string>>;
  sourceProvenanceIds: readonly string[];
  status: AssetStatus;
};

export type DocumentAsset = {
  documentAssetId: string;
  organizationId: string;
  type: DocumentAssetType;
  uri: string;
  contentHash: string | null;
  mimeType: string | null;
  metadata: Readonly<Record<string, string>>;
  sourceProvenanceIds: readonly string[];
  status: AssetStatus;
};

export type CanonicalProduct = ProductConfiguration & {
  productFamilyId: string | null;
  version: number;
  configuration: ProductConfiguration;
  attributeValues: readonly AttributeValue[];
  variants: readonly ProductVariant[];
  mediaAssets: readonly MediaAsset[];
  documentAssets: readonly DocumentAsset[];
};

export type CanonicalCatalogReadModel = {
  productFamilies: readonly ProductFamily[];
  products: readonly CanonicalProduct[];
  productVariants: readonly ProductVariant[];
  attributeDefinitions: readonly AttributeDefinition[];
  attributeValues: readonly AttributeValue[];
  mediaAssets: readonly MediaAsset[];
  documentAssets: readonly DocumentAsset[];
};

function stableHash(parts: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function normalizeIdentityValue(value: string): string {
  return value.trim().toLowerCase();
}

function attributeIdentityValue(value: AttributeValue): string {
  const normalizedValue = normalizeIdentityValue(value.normalizedValue ?? value.rawValue);
  const normalizedUnit = value.unit ? normalizeIdentityValue(value.unit) : "";
  return `${normalizedValue}|${normalizedUnit}`;
}

export function createProductVariantKey(input: {
  productId: string;
  attributeValues: readonly AttributeValue[];
  attributeDefinitions: readonly AttributeDefinition[];
}): string {
  const definitions = new Map(
    input.attributeDefinitions.map((definition) => [definition.attributeDefinitionId, definition]),
  );
  const identityParts = input.attributeValues
    .filter((value) => definitions.get(value.attributeDefinitionId)?.identityBearing === true)
    .map((value) => `${value.attributeDefinitionId}=${attributeIdentityValue(value)}`)
    .sort();

  return stableHash([input.productId, ...identityParts]);
}

function normalizedLegacyIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveLegacyProductFamilyId(
  legacyProductFamily: string | null,
  families: readonly ProductFamily[],
): string | null {
  if (!legacyProductFamily?.trim()) return null;
  const legacyIdentifier = normalizedLegacyIdentifier(legacyProductFamily);

  const family = families.find((candidate) => [
    candidate.productFamilyId,
    candidate.slug,
    candidate.name,
    ...(candidate.legacyIdentifiers ?? []),
  ].some((identifier) => normalizedLegacyIdentifier(identifier) === legacyIdentifier));

  return family?.productFamilyId ?? null;
}

function visibilityFromSpecification(
  visibility: ProductSpecificationVisibility,
): AttributeVisibility {
  return visibility === "public" ? "PUBLIC" : "INTERNAL";
}

export function projectProductSpecificationToAttributeValue(input: {
  productId: string;
  specification: ProductSpecification;
  attributeDefinitionId?: string;
}): AttributeValue {
  const { specification } = input;
  return {
    attributeValueId: `legacy-spec-${stableHash([input.productId, specification.specificationId]).slice(0, 24)}`,
    ownerType: "PRODUCT",
    ownerId: input.productId,
    attributeDefinitionId: input.attributeDefinitionId
      ?? `legacy-specification:${normalizeIdentityValue(specification.key)}`,
    rawValue: specification.rawValue,
    normalizedValue: specification.normalizedValue,
    unit: specification.unit,
    confidence: specification.confidence,
    sourceProvenanceIds: [],
    sourceReference: specification.sourceReference,
    evidenceReference: specification.evidenceReference,
    visibility: visibilityFromSpecification(specification.visibility),
    sortOrder: specification.sortOrder,
  };
}

function referenceAssetId(prefix: string, productId: string, uri: string): string {
  return `${prefix}-${stableHash([productId, uri]).slice(0, 24)}`;
}

export function projectProductMediaReferences(input: {
  productId: string;
  organizationId: string;
  media: ProductMediaReferences;
}): readonly MediaAsset[] {
  const references: { uri: string; type: MediaAssetType; role: string }[] = [];
  if (input.media.primaryImageReference) {
    references.push({ uri: input.media.primaryImageReference, type: "IMAGE", role: "primary" });
  }
  input.media.galleryImageReferences.forEach((uri) => references.push({ uri, type: "IMAGE", role: "gallery" }));
  input.media.videoReferences.forEach((uri) => references.push({ uri, type: "VIDEO", role: "video" }));

  return references.map(({ uri, type, role }) => ({
    mediaAssetId: referenceAssetId("media", input.productId, uri),
    organizationId: input.organizationId,
    type,
    uri,
    contentHash: null,
    mimeType: null,
    metadata: { compatibilityRole: role, productId: input.productId },
    sourceProvenanceIds: [],
    status: "REFERENCE_ONLY",
  }));
}

export function projectProductDocumentReferences(input: {
  productId: string;
  organizationId: string;
  documents: ProductDocumentReferences;
}): readonly DocumentAsset[] {
  const groups: readonly [DocumentAssetType, readonly string[]][] = [
    ["TECHNICAL_DRAWING", input.documents.technicalDrawingReferences],
    ["SPEC_SHEET", input.documents.specSheetReferences],
    ["BROCHURE", input.documents.brochureReferences],
    ["MANUAL", input.documents.manualReferences],
    ["INSTALLATION_GUIDE", input.documents.installationGuideReferences],
    ["WARRANTY", input.documents.warrantyDocumentReferences],
  ];

  return groups.flatMap(([type, references]) => references.map((uri) => ({
    documentAssetId: referenceAssetId("document", input.productId, uri),
    organizationId: input.organizationId,
    type,
    uri,
    contentHash: null,
    mimeType: null,
    metadata: { productId: input.productId },
    sourceProvenanceIds: [],
    status: "REFERENCE_ONLY" as const,
  })));
}

export function projectProductConfiguration(input: {
  product: ProductConfiguration;
  productFamilies?: readonly ProductFamily[];
}): CanonicalProduct {
  const { product } = input;
  return {
    ...product,
    productId: product.productId,
    organizationId: product.organizationId,
    productFamilyId: resolveLegacyProductFamilyId(
      product.productFamily,
      input.productFamilies ?? [],
    ),
    version: 1,
    configuration: product,
    attributeValues: product.specifications.map((specification) =>
      projectProductSpecificationToAttributeValue({ productId: product.productId, specification })),
    variants: [],
    mediaAssets: projectProductMediaReferences({
      productId: product.productId,
      organizationId: product.organizationId,
      media: product.media,
    }),
    documentAssets: projectProductDocumentReferences({
      productId: product.productId,
      organizationId: product.organizationId,
      documents: product.documents,
    }),
  };
}

export function createCanonicalCatalogReadModel(input: {
  products: readonly ProductConfiguration[];
  productFamilies?: readonly ProductFamily[];
  productVariants?: readonly ProductVariant[];
  attributeDefinitions?: readonly AttributeDefinition[];
}): CanonicalCatalogReadModel {
  const productFamilies = input.productFamilies ?? [];
  const productVariants = input.productVariants ?? [];
  const attributeDefinitions = input.attributeDefinitions ?? [];
  const products = input.products.map((product) => projectProductConfiguration({
    product,
    productFamilies,
  }));
  const attributeValues = [
    ...products.flatMap((product) => product.attributeValues),
    ...productVariants.flatMap((variant) => variant.attributeValues),
  ];

  return {
    productFamilies,
    products: products.map((product) => ({
      ...product,
      variants: productVariants.filter((variant) => variant.productId === product.productId),
    })),
    productVariants,
    attributeDefinitions,
    attributeValues,
    mediaAssets: products.flatMap((product) => product.mediaAssets),
    documentAssets: products.flatMap((product) => product.documentAssets),
  };
}