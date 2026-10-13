import type { AttributeDefinition, CanonicalProduct } from "./canonical-catalog";
import { createCanonicalContentHash, type CanonicalJsonValue } from "./canonical-content-hash";
import type { CatalogImportPreview, CatalogRecordPreview } from "./catalog-import-preview";
import type { SourceLocator, SourceProvenance } from "./catalog-lineage";
import {
  SSI_CATALOG_RECONCILIATION_POLICY,
  type SsiCatalogReconciliationPolicy,
  type SsiFamilyPolicy,
  type SsiSheetFamilyDecision,
} from "./ssi-catalog-reconciliation-policy";

export type CatalogReconciliationAction =
  | "MATCH_EXISTING_PRODUCT"
  | "MATCH_EXISTING_PRODUCT_VARIANT"
  | "CREATE_PRODUCT"
  | "CREATE_VARIANT"
  | "NO_CHANGE"
  | "AMBIGUOUS_IDENTITY"
  | "DUPLICATE_SOURCE"
  | "IDENTITY_CONFLICT"
  | "SOURCE_IDENTITY_CONFLICT"
  | "UNSUPPORTED_MAPPING"
  | "REVIEW_REQUIRED";

export type CatalogDecisionReadiness = "READY" | "REVIEW_REQUIRED" | "BLOCKED";

export type CatalogPlanDecision = {
  decisionId: string;
  sourceLocators: readonly SourceLocator[];
  familyId: string;
  action: CatalogReconciliationAction;
  readiness: CatalogDecisionReadiness;
  existingProductId: string | null;
  candidateProductId: string | null;
  candidateVariantId: string | null;
  canonicalName: string;
  sku: string | null;
  identityAttributes: Readonly<Record<string, CanonicalJsonValue>>;
  reason: string;
  confidence: "EXACT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  reviewRequired: boolean;
  provenanceIds: readonly string[];
};

export type AttributeValueProposal = {
  proposalId: string;
  attributeDefinitionId: string;
  sourceLocator: SourceLocator;
  rawValue: CanonicalJsonValue;
  normalizedValue: CanonicalJsonValue;
  unit: string | null;
  identityBearing: boolean;
  provenanceIds: readonly string[];
};

export type CatalogAssociation = {
  associationId: string;
  familyId: string;
  sourceLocator: SourceLocator;
  targetCandidateId: string;
  values: readonly CanonicalJsonValue[];
  provenanceIds: readonly string[];
};

export type ExistingProductReconciliation = {
  existingProductId: string;
  existingProductName: string;
  matchedSourceGroupId: string | null;
  reconciliationAction: "MATCH_EXISTING_PRODUCT" | "NO_CHANGE";
  identityConfidence: "EXACT" | "NONE";
};

export type CatalogReconciliationPlanSummary = {
  sourceDataRows: number;
  productGroupCount: number;
  variantCandidateCount: number;
  variantKeyCollisionCount: number;
  duplicateSourceCount: number;
  sameVariantMultiSourceCount: number;
  sourceIdentityConflictCount: number;
  unresolvedGroupCount: number;
  createProductCount: number;
  matchExistingProductCount: number;
  noChangeProductCount: number;
  createVariantCount: number;
  matchExistingVariantCount: number;
  ambiguousIdentityCount: number;
  identityConflictCount: number;
  reviewRequiredCount: number;
  readyDecisionCount: number;
  blockedDecisionCount: number;
  attributeDefinitionProposalCount: number;
  attributeValueProposalCount: number;
  descriptionAssociationCount: number;
  documentAssociationCount: number;
  mediaAssociationCount: number;
  familyNarrativeAssociationCount: number;
  commercialAssociationCount: number;
};

export type CatalogReconciliationPlan = {
  planId: string;
  sourceImportId: string;
  sourceProfileVersion: string;
  policyId: string;
  policyVersion: string;
  catalogBaseReference: string;
  createdAt: string;
  summary: CatalogReconciliationPlanSummary;
  familyDecisions: readonly SsiSheetFamilyDecision[];
  productDecisions: readonly CatalogPlanDecision[];
  variantDecisions: readonly CatalogPlanDecision[];
  attributeDefinitions: readonly AttributeDefinition[];
  attributeValues: readonly AttributeValueProposal[];
  descriptionAssociations: readonly CatalogAssociation[];
  documentAssociations: readonly CatalogAssociation[];
  mediaAssociations: readonly CatalogAssociation[];
  familyNarrativeAssociations: readonly CatalogAssociation[];
  commercialSourceAssociations: readonly CatalogAssociation[];
  existingProductReconciliation: readonly ExistingProductReconciliation[];
  diagnostics: readonly string[];
  reviewRequirements: readonly string[];
  status: "READY_FOR_BOUNDED_APPLY" | "READY_AFTER_OPERATOR_REVIEW" | "BLOCKED";
  fingerprint: string;
};

export type BuildCatalogReconciliationPlanInput = {
  sourceImportId: string;
  preview: CatalogImportPreview;
  existingProducts: readonly CanonicalProduct[];
  provenance?: readonly SourceProvenance[];
  policy?: SsiCatalogReconciliationPolicy;
};

export function normalizeSsiSku(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function rowValue(row: CatalogRecordPreview, key: string): CanonicalJsonValue | null {
  if (key === "SHEET_NAME") return row.sheetName;
  if (key === "SHEET_FAMILY") return row.sheetName;
  if (key in row.candidateProductIdentity) return row.candidateProductIdentity[key] ?? null;
  return row.candidateAttributeValues[key]
    ?? row.candidateAttributeValues[key.replace(/-/g, " ")]
    ?? null;
}

function locatorKey(locator: SourceLocator): string {
  return `${locator.sheet ?? ""}|${locator.row ?? ""}`;
}

function provenanceIndex(records: readonly SourceProvenance[]): Map<string, readonly string[]> {
  const index = new Map<string, string[]>();
  records.forEach((record) => {
    const key = locatorKey(record.sourceLocator);
    const values = index.get(key) ?? [];
    values.push(record.provenanceId);
    index.set(key, values);
  });
  return index;
}

function legacyFamilyId(product: CanonicalProduct): string | null {
  const legacy = product.productFamily?.trim().toLowerCase();
  if (legacy === "video-walls") return "family-standard-dvled";
  if (legacy === "spheres") return "family-digital-spheres";
  if (legacy === "oled") return "family-oled";
  if (legacy === "kiosks") return "family-kiosks";
  return product.productFamilyId;
}

function candidateId(prefix: string, identity: unknown): string {
  return `${prefix}-${createCanonicalContentHash(identity).slice(0, 24)}`;
}

function unitFromValue(value: CanonicalJsonValue): string | null {
  const match = typeof value === "string"
    ? value.match(/(?:^|\s)(mm|in|ft|nits|hz|v|w)$/i)
    : null;
  return match?.[1].toLowerCase() ?? null;
}

function canonicalAttributeKey(key: string): string {
  const normalized = key.trim().toLowerCase().replace(/\s+/g, "-");
  return normalized === "brighness-refresh" ? "brightness-refresh" : normalized;
}

function identityAttributes(
  row: CatalogRecordPreview,
  familyPolicy: SsiFamilyPolicy,
): Readonly<Record<string, CanonicalJsonValue>> {
  return Object.fromEntries(
    familyPolicy.variantIdentityFields
      .map((field) => [field, rowValue(row, field)] as const)
      .filter((entry): entry is readonly [string, CanonicalJsonValue] => entry[1] !== null)
      .map(([field, value]) => [field, typeof value === "string" ? value.trim() : value]),
  );
}

function observationHash(value: unknown): string {
  return createCanonicalContentHash(value);
}

function technicalObservation(row: CatalogRecordPreview): unknown {
  return Object.fromEntries(
    Object.entries(row.candidateAttributeValues)
      .map(([key, value]) => [canonicalAttributeKey(key), value])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function commercialObservation(row: CatalogRecordPreview): unknown {
  return {
    commercial: row.candidateCommercialFields,
    logistics: row.candidateLogisticsFields,
    tax: row.candidateTaxFields,
  };
}

function contentObservation(row: CatalogRecordPreview): unknown {
  return {
    productIdentity: row.candidateProductIdentity,
    sourceMetadata: row.candidateSourceMetadata,
    media: row.candidateMediaReferences,
    documents: row.candidateDocumentReferences,
  };
}

function exactExistingMatches(
  rows: readonly CatalogRecordPreview[],
  familyId: string,
  canonicalName: string,
  existingProducts: readonly CanonicalProduct[],
): readonly CanonicalProduct[] {
  const sourceSkus = new Set(
    rows.map((row) => row.candidateProductIdentity.SKU)
      .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
      .map(normalizeSsiSku),
  );
  return existingProducts.filter((product) => {
    const skuMatch = sourceSkus.has(normalizeSsiSku(product.sku));
    const nameMatch = normalizeName(product.productName) === normalizeName(canonicalName)
      || normalizeName(product.displayName) === normalizeName(canonicalName);
    return skuMatch || (nameMatch && legacyFamilyId(product) === familyId);
  });
}

function decisionProvenance(
  rows: readonly CatalogRecordPreview[],
  index: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  return [...new Set(rows.flatMap((row) => index.get(locatorKey(row.sourceLocator)) ?? []))].sort();
}

export function buildCatalogReconciliationPlan(
  input: BuildCatalogReconciliationPlanInput,
): CatalogReconciliationPlan {
  const policy = input.policy ?? SSI_CATALOG_RECONCILIATION_POLICY;
  const familyBySheet = new Map(policy.sheetFamilyDecisions.map((decision) => [decision.sheetName, decision]));
  const familyPolicyById = new Map(policy.familyPolicies.map((entry) => [entry.familyId, entry]));
  const headerBySheet = new Map(policy.headerDecisions.map((decision) => [decision.sheetName, decision]));
  const diagnostics: string[] = [];
  const reviewRequirements = new Set<string>();

  input.preview.sheets.forEach((sheet) => {
    const header = headerBySheet.get(sheet.sheetName);
    if (!header || header.headerRow !== sheet.headerSelection.selectedHeaderRow) {
      diagnostics.push(`UNRESOLVED_HEADER:${sheet.sheetName}`);
    }
    if (!familyBySheet.has(sheet.sheetName)) diagnostics.push(`UNRESOLVED_FAMILY:${sheet.sheetName}`);
  });

  const dataRows = input.preview.recordPreviews.filter((row) => row.classification === "DATA");
  const provenanceByRow = provenanceIndex(input.provenance ?? []);
  const groups = new Map<string, CatalogRecordPreview[]>();
  dataRows.forEach((row) => {
    const family = familyBySheet.get(row.sheetName);
    const name = String(row.candidateProductIdentity.PRODUCT_NAME ?? "").trim();
    const groupKey = family && name ? `${family.familyId}|${normalizeName(name)}` : `unresolved|${locatorKey(row.sourceLocator)}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  });

  const groupEntries = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  const skuTargetGroups = new Map<string, Set<string>>();
  groupEntries.forEach(([groupId, rows]) => rows.forEach((row) => {
    const sku = row.candidateProductIdentity.SKU;
    if (typeof sku !== "string" || !sku.trim()) return;
    const normalized = normalizeSsiSku(sku);
    const targets = skuTargetGroups.get(normalized) ?? new Set<string>();
    targets.add(groupId);
    skuTargetGroups.set(normalized, targets);
  }));
  const conflictingSkus = new Set(
    [...skuTargetGroups.entries()].filter(([, targets]) => targets.size > 1).map(([sku]) => sku),
  );

  const productDecisions: CatalogPlanDecision[] = [];
  const variantDecisions: CatalogPlanDecision[] = [];
  const attributeValues: AttributeValueProposal[] = [];
  const descriptionAssociations: CatalogAssociation[] = [];
  const documentAssociations: CatalogAssociation[] = [];
  const mediaAssociations: CatalogAssociation[] = [];
  const commercialSourceAssociations: CatalogAssociation[] = [];

  groupEntries.forEach(([groupId, rows]) => {
    const first = rows[0];
    const family = familyBySheet.get(first.sheetName);
    const familyPolicy = family ? familyPolicyById.get(family.familyId) : null;
    const canonicalName = String(first.candidateProductIdentity.PRODUCT_NAME ?? "").trim();
    const sourceSkus = rows.map((row) => row.candidateProductIdentity.SKU)
      .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
    const exactMatches = family
      ? exactExistingMatches(rows, family.familyId, canonicalName, input.existingProducts)
      : [];
    const hasSkuConflict = sourceSkus.some((sku) => conflictingSkus.has(normalizeSsiSku(sku)));
    const candidateProductId = candidateId("candidate-product", { familyId: family?.familyId, canonicalName: normalizeName(canonicalName) });
    let action: CatalogReconciliationAction = exactMatches.length === 1
      ? "MATCH_EXISTING_PRODUCT"
      : "CREATE_PRODUCT";
    let readiness: CatalogDecisionReadiness = "READY";
    let reason = exactMatches.length === 1
      ? "Exact SKU or exact normalized name and family match."
      : "No exact existing product identity matched; create candidate is deterministic.";
    if (!family || !familyPolicy || !canonicalName) {
      action = "REVIEW_REQUIRED";
      readiness = "REVIEW_REQUIRED";
      reason = "Source group lacks a frozen family or product identity policy.";
    } else if (exactMatches.length > 1 || hasSkuConflict) {
      action = "IDENTITY_CONFLICT";
      readiness = "BLOCKED";
      reason = exactMatches.length > 1
        ? "Source group matches multiple existing products exactly."
        : "Exact SKU targets more than one source product group.";
    }
    const productDecisionId = candidateId("product-decision", { groupId, action, existing: exactMatches.map((product) => product.productId) });
    productDecisions.push({
      decisionId: productDecisionId,
      sourceLocators: rows.map((row) => row.sourceLocator),
      familyId: family?.familyId ?? "unresolved",
      action,
      readiness,
      existingProductId: exactMatches.length === 1 ? exactMatches[0].productId : null,
      candidateProductId: exactMatches.length === 1 ? null : candidateProductId,
      candidateVariantId: null,
      canonicalName,
      sku: sourceSkus.length === 1 ? sourceSkus[0] : null,
      identityAttributes: {},
      reason,
      confidence: readiness === "BLOCKED" ? "NONE" : exactMatches.length === 1 ? "EXACT" : "HIGH",
      reviewRequired: readiness !== "READY",
      provenanceIds: decisionProvenance(rows, provenanceByRow),
    });

    if (rows.length > 1 && familyPolicy && family) {
      const variantGroups = new Map<string, {
        rows: CatalogRecordPreview[];
        attributes: Readonly<Record<string, CanonicalJsonValue>>;
        sku: string | null;
      }>();
      rows.forEach((row) => {
        const attributes = identityAttributes(row, familyPolicy);
        const sku = typeof row.candidateProductIdentity.SKU === "string"
          ? row.candidateProductIdentity.SKU.trim()
          : "";
        const keyInput = {
          familyId: family.familyId,
          productGroup: normalizeName(canonicalName),
          sku: sku ? normalizeSsiSku(sku) : null,
          attributes,
        };
        const variantKey = createCanonicalContentHash(keyInput);
        const variantGroup = variantGroups.get(variantKey) ?? {
          rows: [],
          attributes,
          sku: sku || null,
        };
        variantGroup.rows.push(row);
        variantGroups.set(variantKey, variantGroup);
      });

      const skuVariantKeys = new Map<string, Set<string>>();
      variantGroups.forEach((variantGroup, variantKey) => {
        if (!variantGroup.sku) return;
        const normalizedSku = normalizeSsiSku(variantGroup.sku);
        const keys = skuVariantKeys.get(normalizedSku) ?? new Set<string>();
        keys.add(variantKey);
        skuVariantKeys.set(normalizedSku, keys);
      });
      const conflictingVariantSkus = new Set(
        [...skuVariantKeys.entries()].filter(([, keys]) => keys.size > 1).map(([sku]) => sku),
      );

      [...variantGroups.entries()].sort(([left], [right]) => left.localeCompare(right))
        .forEach(([variantKey, variantGroup]) => {
          const hasVariantIdentity = Boolean(variantGroup.sku || Object.keys(variantGroup.attributes).length > 0);
          const sourceIdentityConflict = variantGroup.sku
            ? conflictingVariantSkus.has(normalizeSsiSku(variantGroup.sku))
            : false;
          const technicalHashes = new Set(variantGroup.rows.map((row) => observationHash(technicalObservation(row))));
          const commercialHashes = new Set(variantGroup.rows.map((row) => observationHash(commercialObservation(row))));
          const contentHashes = new Set(variantGroup.rows.map((row) => observationHash(contentObservation(row))));
          const duplicateObservation = variantGroup.rows.length > 1
            && technicalHashes.size === 1
            && commercialHashes.size === 1
            && contentHashes.size === 1;
          const sameVariantMultiSource = variantGroup.rows.length > 1 && !duplicateObservation;
          const action: CatalogReconciliationAction = sourceIdentityConflict
            ? "SOURCE_IDENTITY_CONFLICT"
            : hasVariantIdentity
              ? "CREATE_VARIANT"
              : "REVIEW_REQUIRED";
          const readiness: CatalogDecisionReadiness = sourceIdentityConflict
            ? "BLOCKED"
            : hasVariantIdentity
              ? "READY"
              : "REVIEW_REQUIRED";
          const reason = sourceIdentityConflict
            ? "One exact SKU asserts more than one technical variant identity."
            : duplicateObservation
              ? "Exact duplicate source observations consolidate into one technical variant."
              : sameVariantMultiSource
                ? "Multiple source observations consolidate into one technical variant; non-identity differences remain associated."
                : hasVariantIdentity
                  ? "Family-specific variant identity is deterministic."
                  : "Repeated source product lacks SKU and reviewed identity-bearing attribute values.";
          variantDecisions.push({
          decisionId: candidateId("variant-decision", { groupId, variantKey }),
          sourceLocators: variantGroup.rows.map((row) => row.sourceLocator),
          familyId: family.familyId,
          action,
          readiness,
          existingProductId: exactMatches.length === 1 ? exactMatches[0].productId : null,
          candidateProductId: exactMatches.length === 1 ? null : candidateProductId,
          candidateVariantId: candidateId("candidate-variant", variantKey),
          canonicalName,
          sku: variantGroup.sku,
          identityAttributes: variantGroup.attributes,
          reason,
          confidence: sourceIdentityConflict ? "NONE" : hasVariantIdentity ? "HIGH" : "LOW",
          reviewRequired: readiness !== "READY",
          provenanceIds: decisionProvenance(variantGroup.rows, provenanceByRow),
        });
      });
    }

    rows.forEach((row) => {
      const targetCandidateId = exactMatches[0]?.productId ?? candidateProductId;
      const rowProvenance = decisionProvenance([row], provenanceByRow);
      Object.entries(row.candidateAttributeValues).forEach(([rawKey, rawValue]) => {
        const key = canonicalAttributeKey(rawKey);
        const definition = policy.attributeDefinitions.find((candidate) => candidate.key === key);
        if (!definition) return;
        attributeValues.push({
          proposalId: candidateId("attribute-value", { locator: row.sourceLocator, key, rawValue }),
          attributeDefinitionId: definition.attributeDefinitionId,
          sourceLocator: row.sourceLocator,
          rawValue,
          normalizedValue: typeof rawValue === "string" ? rawValue.trim() : rawValue,
          unit: unitFromValue(rawValue),
          identityBearing: Boolean(familyPolicy?.variantIdentityFields.includes(key)),
          provenanceIds: rowProvenance,
        });
      });
      const association = (
        prefix: string,
        values: readonly CanonicalJsonValue[],
      ): CatalogAssociation => ({
        associationId: candidateId(prefix, { locator: row.sourceLocator, values }),
        familyId: family?.familyId ?? "unresolved",
        sourceLocator: row.sourceLocator,
        targetCandidateId,
        values,
        provenanceIds: rowProvenance,
      });
      const description = row.candidateProductIdentity.DESCRIPTION;
      if (description !== undefined && description !== null) {
        descriptionAssociations.push(association("description-association", [description]));
      }
      if (row.candidateDocumentReferences.length) {
        documentAssociations.push(association("document-association", row.candidateDocumentReferences));
      }
      if (row.candidateMediaReferences.length) {
        mediaAssociations.push(association("media-association", row.candidateMediaReferences));
      }
      const commercialValues = [
        ...Object.entries(row.candidateCommercialFields).map(([field, value]) => ({ domain: "COMMERCIAL", field, value })),
        ...Object.entries(row.candidateLogisticsFields).map(([field, value]) => ({ domain: "LOGISTICS", field, value })),
        ...Object.entries(row.candidateTaxFields).map(([field, value]) => ({ domain: "TAX", field, value })),
      ];
      if (commercialValues.length) {
        commercialSourceAssociations.push(association("commercial-association", commercialValues));
      }
    });
  });

  const familyNarrativeAssociations: CatalogAssociation[] = input.preview.recordPreviews
    .filter((row) => row.classification === "NARRATIVE")
    .map((row) => {
      const family = familyBySheet.get(row.sheetName);
      return {
        associationId: candidateId("family-narrative", { locator: row.sourceLocator, raw: row.rawValues }),
        familyId: family?.familyId ?? "unresolved",
        sourceLocator: row.sourceLocator,
        targetCandidateId: family?.familyId ?? "unresolved",
        values: [...new Set(Object.values(row.rawValues).map((cell) => cell.rawValue).filter((value) => value !== null))],
        provenanceIds: decisionProvenance([row], provenanceByRow),
      };
    });

  const matchedDecisionByProduct = new Map(
    productDecisions.filter((decision) => decision.existingProductId)
      .map((decision) => [decision.existingProductId as string, decision]),
  );
  const existingProductReconciliation = input.existingProducts.map((product) => {
    const match = matchedDecisionByProduct.get(product.productId);
    return {
      existingProductId: product.productId,
      existingProductName: product.productName,
      matchedSourceGroupId: match?.decisionId ?? null,
      reconciliationAction: match ? "MATCH_EXISTING_PRODUCT" as const : "NO_CHANGE" as const,
      identityConfidence: match ? "EXACT" as const : "NONE" as const,
    };
  });

  if (diagnostics.some((diagnostic) => diagnostic.startsWith("UNRESOLVED_HEADER"))) {
    reviewRequirements.add("Resolve every source header selection.");
  }
  if (diagnostics.some((diagnostic) => diagnostic.startsWith("UNRESOLVED_FAMILY"))) {
    reviewRequirements.add("Resolve every sheet-to-family mapping.");
  }
  if (variantDecisions.some((decision) => decision.reviewRequired)) {
    reviewRequirements.add("Review unresolved or colliding family-specific variant identities.");
  }
  if (variantDecisions.some((decision) =>
    decision.sourceLocators.length > 1
    && decision.reason.includes("non-identity differences"))) {
    reviewRequirements.add("Review multiple commercial or content observations associated with one technical variant.");
  }

  const allDecisions = [...productDecisions, ...variantDecisions];
  const summary: CatalogReconciliationPlanSummary = {
    sourceDataRows: dataRows.length,
    productGroupCount: productDecisions.length,
    variantCandidateCount: variantDecisions.length,
    variantKeyCollisionCount: 0,
    duplicateSourceCount: variantDecisions.reduce(
      (total, decision) => total + (decision.reason.startsWith("Exact duplicate") ? decision.sourceLocators.length - 1 : 0),
      0,
    ),
    sameVariantMultiSourceCount: variantDecisions.filter((decision) =>
      decision.sourceLocators.length > 1
      && decision.reason.includes("non-identity differences")).length,
    sourceIdentityConflictCount: allDecisions.filter((decision) => decision.action === "SOURCE_IDENTITY_CONFLICT").length,
    unresolvedGroupCount: allDecisions.filter((decision) => decision.readiness !== "READY").length,
    createProductCount: productDecisions.filter((decision) => decision.action === "CREATE_PRODUCT").length,
    matchExistingProductCount: productDecisions.filter((decision) => decision.action === "MATCH_EXISTING_PRODUCT").length,
    noChangeProductCount: existingProductReconciliation.filter((decision) => decision.reconciliationAction === "NO_CHANGE").length,
    createVariantCount: variantDecisions.filter((decision) => decision.action === "CREATE_VARIANT").length,
    matchExistingVariantCount: variantDecisions.filter((decision) => decision.action === "MATCH_EXISTING_PRODUCT_VARIANT").length,
    ambiguousIdentityCount: allDecisions.filter((decision) => decision.action === "AMBIGUOUS_IDENTITY" || decision.action === "REVIEW_REQUIRED").length,
    identityConflictCount: allDecisions.filter((decision) =>
      decision.action === "IDENTITY_CONFLICT" || decision.action === "SOURCE_IDENTITY_CONFLICT").length,
    reviewRequiredCount: allDecisions.filter((decision) => decision.readiness === "REVIEW_REQUIRED").length,
    readyDecisionCount: allDecisions.filter((decision) => decision.readiness === "READY").length,
    blockedDecisionCount: allDecisions.filter((decision) => decision.readiness === "BLOCKED").length,
    attributeDefinitionProposalCount: policy.attributeDefinitions.length,
    attributeValueProposalCount: attributeValues.length,
    descriptionAssociationCount: descriptionAssociations.length,
    documentAssociationCount: documentAssociations.reduce((total, association) => total + association.values.length, 0),
    mediaAssociationCount: mediaAssociations.reduce((total, association) => total + association.values.length, 0),
    familyNarrativeAssociationCount: familyNarrativeAssociations.length,
    commercialAssociationCount: commercialSourceAssociations.length,
  };
  const catalogBaseReference = createCanonicalContentHash(
    input.existingProducts.map((product) => ({
      productId: product.productId,
      version: product.version,
      sku: product.sku,
      productName: product.productName,
      productFamilyId: legacyFamilyId(product),
    })).sort((left, right) => left.productId.localeCompare(right.productId)),
  );
  const semantic = {
    sourceImportId: input.sourceImportId,
    previewFingerprint: input.preview.semanticFingerprint,
    sourceProfileVersion: policy.sourceProfileVersion,
    policyId: policy.policyId,
    policyVersion: policy.version,
    catalogBaseReference,
    familyDecisions: policy.sheetFamilyDecisions,
    productDecisions,
    variantDecisions,
    attributeDefinitions: policy.attributeDefinitions,
    attributeValues,
    descriptionAssociations,
    documentAssociations,
    mediaAssociations,
    familyNarrativeAssociations,
    commercialSourceAssociations,
    existingProductReconciliation,
    diagnostics,
    reviewRequirements: [...reviewRequirements].sort(),
  };
  const fingerprint = createCanonicalContentHash(semantic);
  const status = summary.blockedDecisionCount > 0 || diagnostics.length > 0
    ? "BLOCKED"
    : summary.reviewRequiredCount > 0 || reviewRequirements.size > 0
      ? "READY_AFTER_OPERATOR_REVIEW"
      : "READY_FOR_BOUNDED_APPLY";

  return {
    planId: `catalog-reconciliation-plan-${fingerprint.slice(0, 24)}`,
    sourceImportId: input.sourceImportId,
    sourceProfileVersion: policy.sourceProfileVersion,
    policyId: policy.policyId,
    policyVersion: policy.version,
    catalogBaseReference,
    createdAt: new Date().toISOString(),
    summary,
    familyDecisions: policy.sheetFamilyDecisions,
    productDecisions,
    variantDecisions,
    attributeDefinitions: policy.attributeDefinitions,
    attributeValues,
    descriptionAssociations,
    documentAssociations,
    mediaAssociations,
    familyNarrativeAssociations,
    commercialSourceAssociations,
    existingProductReconciliation,
    diagnostics,
    reviewRequirements: [...reviewRequirements].sort(),
    status,
    fingerprint,
  };
}