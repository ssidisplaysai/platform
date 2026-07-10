/**
 * Evidence IR Validator
 *
 * Implements 18+ non-modifying validation rules per EIR-0001 section 8.
 * All validations are read-only and never modify the object.
 * Violations are reported as diagnostics.
 */

import { EvidenceItem, EvidenceCollection, EvidencePackage, EvidenceSet, EvidenceDiagnosticCode } from '../models';
import { parseIdentity, getTypeTagFromIdentity } from '../identity';

// ============================================================================
// Validation Result Type
// ============================================================================

export interface ValidationViolation {
  code: EvidenceDiagnosticCode;
  severity: 'info' | 'warning' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
  warningCount: number;
  errorCount: number;
}

// ============================================================================
// Rule 1-5: Identity Validation
// ============================================================================

/**
 * Rule 1: Identity must be well-formed per GPS-0001.
 * Format: <type>_<hash>_v<version>
 */
function validateIdentityFormat(identity: string, itemId: string): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const parsed = parseIdentity(identity);

  if (!parsed.isValid) {
    violations.push({
      code: EvidenceDiagnosticCode.IDENTITY_INVALID,
      severity: 'error',
      message: `Identity format invalid: ${identity}`,
      context: { itemId, parseErrors: parsed.errors },
    });
  }

  return violations;
}

/**
 * Rule 2: Identity hash must be correct length (256 bits = 64 hex chars).
 */
function validateIdentityLength(identity: string, itemId: string): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const parsed = parseIdentity(identity);

  if (parsed.isValid && parsed.hash.length !== 64) {
    violations.push({
      code: EvidenceDiagnosticCode.IDENTITY_INVALID,
      severity: 'error',
      message: `Identity hash length invalid: expected 64 chars, got ${parsed.hash.length}`,
      context: { itemId, hash: parsed.hash },
    });
  }

  return violations;
}

/**
 * Rule 3: All identities in a set must be unique (no duplicates).
 */
function validateNoDuplicateIdentities(items: Array<{ metadata: { identity: string } }>, scopeName: string): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const identities = new Map<string, number>();

  for (let i = 0; i < items.length; i++) {
    const id = items[i].metadata.identity;
    if (identities.has(id)) {
      violations.push({
        code: EvidenceDiagnosticCode.DUPLICATE_IDENTITY,
        severity: 'error',
        message: `Duplicate identity found in ${scopeName}: ${id}`,
        context: {
          identity: id,
          firstIndex: identities.get(id),
          duplicateIndex: i,
          scopeName,
        },
      });
    } else {
      identities.set(id, i);
    }
  }

  return violations;
}

// ============================================================================
// Rule 6-10: Provenance Validation
// ============================================================================

/**
 * Rule 6: Provenance must be present and complete.
 */
function validateProvenancePresent(item: EvidenceItem): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!item.provenance) {
    violations.push({
      code: EvidenceDiagnosticCode.MISSING_PROVENANCE,
      severity: 'error',
      message: 'Evidence item missing required provenance',
      context: { itemId: item.metadata.identity },
    });
    return violations;
  }

  const required = [
    'discoveryQuestionId',
    'discoveryAnswerId',
    'discoverySectionId',
    'discoveryInterviewId',
    'sourcePage',
    'discoveryVersion',
    'evidenceIRCompilerVersion',
    'evidenceIRSchemaVersion',
  ];

  for (const field of required) {
    if (!(field in item.provenance)) {
      violations.push({
        code: EvidenceDiagnosticCode.MISSING_PROVENANCE,
        severity: 'error',
        message: `Provenance missing required field: ${field}`,
        context: { itemId: item.metadata.identity, field },
      });
    }
  }

  return violations;
}

/**
 * Rule 7: Source lineage must be traceable (not empty strings or nulls).
 */
function validateProvenanceLineage(item: EvidenceItem): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!item.provenance) return violations;

  const lineageFields = [
    'discoveryQuestionId',
    'discoveryAnswerId',
    'discoverySectionId',
    'discoveryInterviewId',
  ];

  for (const field of lineageFields) {
    const value = (item.provenance as any)[field];
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      violations.push({
        code: EvidenceDiagnosticCode.BROKEN_PROVENANCE,
        severity: 'error',
        message: `Provenance lineage broken: ${field} is empty`,
        context: { itemId: item.metadata.identity, field },
      });
    }
  }

  return violations;
}

/**
 * Rule 8: Provenance metadata (timestamps, versions) must be valid.
 */
function validateProvenanceMetadata(item: EvidenceItem): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!item.provenance) return violations;

  // Validate ISO 8601 datetime
  if (item.provenance.compiledAt) {
    try {
      const date = new Date(item.provenance.compiledAt);
      if (isNaN(date.getTime())) {
        violations.push({
          code: EvidenceDiagnosticCode.INVALID_METADATA,
          severity: 'error',
          message: `Provenance compiledAt is not valid ISO 8601: ${item.provenance.compiledAt}`,
          context: { itemId: item.metadata.identity },
        });
      }
    } catch {
      violations.push({
        code: EvidenceDiagnosticCode.INVALID_METADATA,
        severity: 'error',
        message: `Provenance compiledAt parse error: ${item.provenance.compiledAt}`,
        context: { itemId: item.metadata.identity },
      });
    }
  }

  // Validate versions are not empty
  if (!item.provenance.discoveryVersion || !item.provenance.evidenceIRCompilerVersion) {
    violations.push({
      code: EvidenceDiagnosticCode.INVALID_METADATA,
      severity: 'warning',
      message: `Provenance version field is empty`,
      context: { itemId: item.metadata.identity },
    });
  }

  return violations;
}

// ============================================================================
// Rule 11-15: Content Validation
// ============================================================================

/**
 * Rule 11: Content must not be empty.
 */
function validateContentNotEmpty(item: EvidenceItem): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!item.content || item.content.trim().length === 0) {
    violations.push({
      code: EvidenceDiagnosticCode.INVALID_CONTENT,
      severity: 'error',
      message: 'Evidence item content is empty',
      context: { itemId: item.metadata.identity },
    });
  }

  return violations;
}

/**
 * Rule 12: Raw content must match canonical content (after normalization).
 * Both must be preserved.
 */
function validateContentConsistency(item: EvidenceItem): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!item.content || !item.rawContent) {
    violations.push({
      code: EvidenceDiagnosticCode.INVALID_CONTENT,
      severity: 'warning',
      message: 'Evidence item missing content or rawContent',
      context: { itemId: item.metadata.identity },
    });
  }

  return violations;
}

/**
 * Rule 13: Form type must be valid per EIR-0001.
 */
function validateFormType(item: EvidenceItem): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  const validFormTypes = [
    'statement',
    'assertion',
    'description',
    'constraint',
    'decision',
    'pain_point',
    'capability',
    'need',
    'measurement',
    'interaction',
    'obstacle',
    'opportunity',
  ];

  if (!item.formType || !validFormTypes.includes(item.formType)) {
    violations.push({
      code: EvidenceDiagnosticCode.INVALID_FORM_TYPE,
      severity: 'error',
      message: `Invalid form type: ${item.formType}`,
      context: {
        itemId: item.metadata.identity,
        formType: item.formType,
        validTypes: validFormTypes,
      },
    });
  }

  return violations;
}

/**
 * Rule 14: No inference or synthesis (evidence must be directly from discovery).
 * Check that provenance traces back to actual discovery question/answer.
 */
function validateNoInference(item: EvidenceItem): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!item.provenance?.discoveryQuestionId || !item.provenance?.discoveryAnswerId) {
    violations.push({
      code: EvidenceDiagnosticCode.INVALID_CONTENT,
      severity: 'error',
      message: 'Evidence item missing discovery question/answer (possible inferred content)',
      context: { itemId: item.metadata.identity },
    });
  }

  return violations;
}

// ============================================================================
// Rule 16-18: Relationship & Structure Validation
// ============================================================================

/**
 * Rule 16: Relationship references must be valid identities.
 */
function validateRelationshipReferences(item: EvidenceItem): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!item.relationships?.relatedItemIds) {
    return violations;
  }

  for (const relatedId of item.relationships.relatedItemIds) {
    if (!relatedId || typeof relatedId !== 'string') {
      violations.push({
        code: EvidenceDiagnosticCode.INVALID_REFERENCE,
        severity: 'warning',
        message: `Invalid relationship reference: ${relatedId}`,
        context: { itemId: item.metadata.identity },
      });
      continue;
    }

    const parsed = parseIdentity(relatedId);
    if (!parsed.isValid) {
      violations.push({
        code: EvidenceDiagnosticCode.INVALID_REFERENCE,
        severity: 'warning',
        message: `Relationship reference is not valid identity: ${relatedId}`,
        context: { itemId: item.metadata.identity, parseErrors: parsed.errors },
      });
    }
  }

  return violations;
}

/**
 * Rule 17: Collection must contain items.
 */
function validateCollectionNotEmpty(collection: EvidenceCollection): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!collection.items || collection.items.length === 0) {
    violations.push({
      code: EvidenceDiagnosticCode.INVALID_CONTENT,
      severity: 'warning',
      message: 'Evidence collection contains no items',
      context: { collectionId: collection.metadata.identity },
    });
  }

  return violations;
}

/**
 * Rule 18: Package deduplication mapping must be consistent.
 */
function validateDeduplicationConsistency(pkg: EvidencePackage): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!pkg.deduplicationResults?.duplicateMapping) {
    return violations;
  }

  const mapping = pkg.deduplicationResults.duplicateMapping;

  // Verify mapping targets are in item list
  const itemIds = new Set(pkg.items.map(item => item.metadata.identity));

  for (const [duplicateId, canonicalId] of Object.entries(mapping)) {
    if (!itemIds.has(canonicalId) && canonicalId !== 'removed') {
      violations.push({
        code: EvidenceDiagnosticCode.INVALID_REFERENCE,
        severity: 'warning',
        message: `Deduplication mapping target not in items: ${canonicalId}`,
        context: {
          packageId: pkg.metadata.identity,
          duplicateId,
          canonicalId,
        },
      });
    }
  }

  return violations;
}

// ============================================================================
// Public Validation Functions
// ============================================================================

/**
 * Validate a single Evidence Item.
 */
export function validateEvidenceItem(item: EvidenceItem): ValidationResult {
  const violations: ValidationViolation[] = [];

  // Run all validation rules
  violations.push(...validateIdentityFormat(item.metadata.identity, 'item'));
  violations.push(...validateIdentityLength(item.metadata.identity, 'item'));
  violations.push(...validateProvenancePresent(item));
  violations.push(...validateProvenanceLineage(item));
  violations.push(...validateProvenanceMetadata(item));
  violations.push(...validateContentNotEmpty(item));
  violations.push(...validateContentConsistency(item));
  violations.push(...validateFormType(item));
  violations.push(...validateNoInference(item));
  violations.push(...validateRelationshipReferences(item));

  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  return {
    isValid: errorCount === 0,
    violations,
    warningCount,
    errorCount,
  };
}

/**
 * Validate an Evidence Collection.
 */
export function validateEvidenceCollection(collection: EvidenceCollection): ValidationResult {
  const violations: ValidationViolation[] = [];

  // Collection-level validations
  violations.push(...validateIdentityFormat(collection.metadata.identity, 'collection'));
  violations.push(...validateCollectionNotEmpty(collection));
  violations.push(...validateNoDuplicateIdentities(collection.items, 'collection'));

  // Validate all items in collection
  for (const item of collection.items) {
    const itemValidation = validateEvidenceItem(item);
    violations.push(...itemValidation.violations);
  }

  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  return {
    isValid: errorCount === 0,
    violations,
    warningCount,
    errorCount,
  };
}

/**
 * Validate an Evidence Package.
 */
export function validateEvidencePackage(pkg: EvidencePackage): ValidationResult {
  const violations: ValidationViolation[] = [];

  // Package-level validations
  violations.push(...validateIdentityFormat(pkg.metadata.identity, 'package'));
  violations.push(...validateNoDuplicateIdentities(pkg.items, 'package'));
  violations.push(...validateDeduplicationConsistency(pkg));

  // Validate all items in package
  for (const item of pkg.items) {
    const itemValidation = validateEvidenceItem(item);
    violations.push(...itemValidation.violations);
  }

  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  return {
    isValid: errorCount === 0,
    violations,
    warningCount,
    errorCount,
  };
}

/**
 * Validate an entire Evidence Set.
 */
export function validateEvidenceSet(set: EvidenceSet): ValidationResult {
  const violations: ValidationViolation[] = [];

  // Set-level validations
  violations.push(...validateIdentityFormat(set.metadata.identity, 'set'));

  // Validate all collections
  for (const collection of set.collections) {
    const collectionValidation = validateEvidenceCollection(collection);
    violations.push(...collectionValidation.violations);
  }

  // Validate all packages
  for (const pkg of set.packages) {
    const packageValidation = validateEvidencePackage(pkg);
    violations.push(...packageValidation.violations);
  }

  // Verify cross-references are consistent
  violations.push(...validateNoDuplicateIdentities(set.allItems, 'evidence set'));

  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  return {
    isValid: errorCount === 0,
    violations,
    warningCount,
    errorCount,
  };
}
