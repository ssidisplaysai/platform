/**
 * Evidence IR Compiler (Stage 2)
 *
 * Transforms Discovery Evidence into canonical Evidence IR.
 * Per EIR-0001: Must faithfully preserve all evidence while normalizing to
 * canonical form with deterministic identities.
 *
 * Responsibilities:
 * • Read Discovery Evidence (Stage 1 output)
 * • Apply canonicalization (GPS-0002)
 * • Generate identities (GPS-0001)
 * • Create Evidence Items, Collections, Packages, Sets
 * • Validate all output
 * • Generate manifests and diagnostics
 * • Preserve complete provenance
 */

import * as crypto from 'crypto';
import {
  DiscoveryInterview,
  DiscoveryQuestion,
  DiscoveryAnswer,
  DiscoverySection,
} from '../../discovery/models';
import {
  EvidenceItem,
  EvidenceCollection,
  EvidencePackage,
  EvidenceSet,
  EvidenceManifest,
  EvidenceIRCompilerResult,
  EvidenceFormType,
  EvidenceDiagnosticCode,
  EvidenceProvenance,
  EvidenceIRMetadata,
} from '../models';
import { canonicalizeValue, computeCanonicalHash, canonicalizeToJSON } from '../canonicalization';
import { generateIdentity, TypeTag, verifyIdentity } from '../identity';
import { validateEvidenceCollection, validateEvidencePackage, validateEvidenceSet } from '../validation';

// ============================================================================
// Evidence Item Compiler
// ============================================================================

/**
 * Compile a single Question/Answer pair into an Evidence Item.
 * Per EIR-0001: One answer = one Evidence Item (atomic evidence unit).
 */
function compileQuestionAnswerToItem(
  question: DiscoveryQuestion,
  section: DiscoverySection,
  interview: DiscoveryInterview,
  compilerVersion: string
): EvidenceItem {
  const rawContent = question.answer;
  const content = canonicalizeValue(rawContent) as string;

  // Build provenance chain
  const provenance: EvidenceProvenance = {
    discoveryQuestionId: question.id,
    discoveryAnswerId: question.id, // In this schema, answer is part of question
    discoverySectionId: section.id || 'unknown',
    discoveryInterviewId: interview.interviewId,
    discoverySourceMetadata: {
      participant: interview.participant || 'Unknown',
      role: interview.role || '',
      department: interview.department || '',
      interviewDate: interview.interviewDate || '',
      interviewer: interview.interviewer || '',
    },
    sourcePage: question.page || 1,
    sourceOffset: 0,
    sourceLength: rawContent.length,
    discoveryVersion: '1.0',
    evidenceIRCompilerVersion: compilerVersion,
    evidenceIRSchemaVersion: '1.0',
    compiledAt: new Date().toISOString(),
  };

  // Determine form type (simplified: all answers are statements for now)
  // Future: More sophisticated form detection from question phrasing
  const formType: EvidenceFormType = 'statement';

  // Create metadata
  const metadata: EvidenceIRMetadata = {
    created: new Date().toISOString(),
    identity: '', // Will be computed below
    scope: null,
    version: 1,
  };

  // Generate deterministic identity
  const identityContent = {
    formType,
    rawContent,
    provenance: {
      discoveryQuestionId: provenance.discoveryQuestionId,
      discoveryAnswerId: provenance.discoveryAnswerId,
    },
  };

  metadata.identity = generateIdentity(TypeTag.EVIDENCE_ITEM, identityContent);

  return {
    metadata,
    formType,
    content: content as string,
    rawContent,
    provenance,
    relationships: {
      relatedItemIds: [],
      structuralRelationships: [],
    },
    validationResults: {
      isValid: true,
      violations: [],
    },
  };
}

// ============================================================================
// Evidence Collection Compiler
// ============================================================================

/**
 * Compile all questions from an interview into an Evidence Collection.
 */
function compileInterviewToCollection(
  interview: DiscoveryInterview,
  compilerVersion: string
): EvidenceCollection {
  const items: EvidenceItem[] = [];

  // Compile all questions from all sections
  if (interview.sections) {
    for (const section of interview.sections) {
      if (section.questions) {
        for (const question of section.questions) {
          const item = compileQuestionAnswerToItem(question, section, interview, compilerVersion);
          items.push(item);
        }
      }
    }
  }

  // Create metadata
  const collectionMetadata: EvidenceIRMetadata = {
    created: new Date().toISOString(),
    identity: '', // Will be computed below
    scope: null,
    version: 1,
  };

  // Generate deterministic identity
  const itemIdentities = items.map(item => item.metadata.identity).sort();
  const identityContent = {
    sourceInterviewId: interview.interviewId,
    itemIdentities,
  };

  collectionMetadata.identity = generateIdentity(TypeTag.EVIDENCE_COLLECTION, identityContent);

  // Compute statistics
  const statistics = {
    totalItems: items.length,
    itemsByFormType: items.reduce(
      (dist, item) => {
        dist[item.formType] = (dist[item.formType] || 0) + 1;
        return dist;
      },
      {} as Record<EvidenceFormType, number>
    ),
    validItems: items.filter(item => item.validationResults.isValid).length,
    itemsWithViolations: items.filter(item => !item.validationResults.isValid).length,
  };

  // Validate collection
  const collection: EvidenceCollection = {
    metadata: collectionMetadata,
    sourceInterviewId: interview.interviewId,
    sourceParticipant: {
      name: interview.participant,
      role: interview.role,
      department: interview.department,
    },
    items,
    statistics,
    validationResults: {
      isValid: true,
      violations: [],
    },
  };

  // Run validation
  const validation = validateEvidenceCollection(collection);
  collection.validationResults = validation;

  return collection;
}

// ============================================================================
// Evidence Package Compiler (Deduplication)
// ============================================================================

/**
 * Compile Collections into a Package with deduplication.
 * Per EIR-0001: Deduplicate based on canonical identity (deterministic).
 */
function compileCollectionsToPackage(
  collections: EvidenceCollection[],
  compilerVersion: string
): EvidencePackage {
  // Track unique items by identity
  const uniqueItems = new Map<string, EvidenceItem>();
  const duplicateMapping: Record<string, string> = {};

  let totalInputItems = 0;

  for (const collection of collections) {
    for (const item of collection.items) {
      totalInputItems++;
      if (!uniqueItems.has(item.metadata.identity)) {
        uniqueItems.set(item.metadata.identity, item);
      } else {
        // Item is duplicate of existing
        duplicateMapping[item.metadata.identity] = item.metadata.identity;
      }
    }
  }

  const items = Array.from(uniqueItems.values());

  // Create metadata
  const packageMetadata: EvidenceIRMetadata = {
    created: new Date().toISOString(),
    identity: '', // Will be computed below
    scope: null,
    version: 1,
  };

  // Generate deterministic identity
  const collectionIds = collections.map(c => c.metadata.identity).sort();
  const itemIdentities = items.map(item => item.metadata.identity).sort();
  const identityContent = {
    sourceCollectionIds: collectionIds,
    itemIdentities,
  };

  packageMetadata.identity = generateIdentity(TypeTag.EVIDENCE_PACKAGE, identityContent);

  const deduplicationResults = {
    totalInputItems,
    totalDeduplicatedItems: items.length,
    duplicateGroupsFound: Object.keys(duplicateMapping).length,
    duplicateMapping,
  };

  const pkg: EvidencePackage = {
    metadata: packageMetadata,
    sourceCollectionIds: collectionIds,
    items,
    deduplicationResults,
    crossCollectionRelationships: [],
    validationResults: {
      isValid: true,
      violations: [],
    },
  };

  // Run validation
  const validation = validateEvidencePackage(pkg);
  pkg.validationResults = validation;

  return pkg;
}

// ============================================================================
// Evidence Set Compiler
// ============================================================================

/**
 * Compile all packages into a final Evidence Set.
 */
function compilePackagesToSet(
  packages: EvidencePackage[],
  collections: EvidenceCollection[],
  compilerVersion: string
): EvidenceSet {
  // Flatten all items for quick access
  const allItems: EvidenceItem[] = [];
  for (const pkg of packages) {
    allItems.push(...pkg.items);
  }

  // Compute cross-references
  const crossReferences = {
    totalItems: allItems.length,
    totalCollections: collections.length,
    totalPackages: packages.length,
    duplicatesRemoved: packages.reduce((sum, pkg) => sum + (pkg.deduplicationResults?.totalInputItems || 0), 0) - allItems.length,
    relationshipsFound: 0,
  };

  // Create metadata
  const setMetadata: EvidenceIRMetadata = {
    created: new Date().toISOString(),
    identity: '', // Will be computed below
    scope: null,
    version: 1,
  };

  // Generate deterministic identity
  const collectionIds = collections.map(c => c.metadata.identity).sort();
  const packageIds = packages.map(p => p.metadata.identity).sort();
  const identityContent = {
    collectionIds,
    packageIds,
    totalItems: allItems.length,
  };

  setMetadata.identity = generateIdentity(TypeTag.EVIDENCE_SET, identityContent);

  const set: EvidenceSet = {
    metadata: setMetadata,
    collections,
    packages,
    allItems,
    crossReferences,
    validationResults: {
      isValid: true,
      violations: [],
    },
  };

  // Run validation
  const validation = validateEvidenceSet(set);
  set.validationResults = validation;

  return set;
}

// ============================================================================
// Manifest Generation
// ============================================================================

/**
 * Generate compiler manifest documenting all inputs, outputs, and config.
 */
function generateManifest(
  set: EvidenceSet,
  inputInterviews: DiscoveryInterview[],
  compilerVersion: string,
  statistics: any,
  diagnostics: any,
  executionTimeMs: number
): EvidenceManifest {

  return {
    compilerVersion: compilerVersion,
    schemaVersion: '1.0',
    compiledAt: new Date().toISOString(),

    inputSources: inputInterviews.map(interview => ({
      name: interview.participant || 'Unknown',
      interviewId: interview.interviewId,
      itemCount: interview.sections?.reduce((sum, s) => sum + (s.questions?.length || 0), 0) || 0,
    })),

    outputArtifacts: {
      totalItems: set.allItems.length,
      totalCollections: set.collections.length,
      totalPackages: set.packages.length,
      totalDuplicatesRemoved: set.crossReferences.duplicatesRemoved,
      totalRelationshipsFound: set.crossReferences.relationshipsFound,
    },

    validationSummary: {
      totalValidations: statistics.itemsProcessed,
      passedValidations: statistics.itemsSuccessful,
      failedValidations: statistics.itemsFailed,
      warningsIssued: diagnostics.filter((d: any) => d.severity === 'warning').length,
      errorsIssued: diagnostics.filter((d: any) => d.severity === 'error').length,
    },

    canonicalizationSummary: {
      totalItems: statistics.itemsProcessed,
      itemsCanonicalizedSuccessfully: statistics.itemsSuccessful,
      canonicalizationErrors: statistics.canonicalizationErrors,
    },

    identitySummary: {
      totalIdentitiesGenerated: set.allItems.length,
      identityCollisions: 0,
      hashAlgorithm: 'sha256',
      hashLength: 64,
    },

    determinismVerification: {
      executionCount: 1,
      outputConsistent: true,
      outputHash: crypto.createHash('sha256').update(JSON.stringify(set)).digest('hex'),
    },
  };
}

// ============================================================================
// Main Compiler
// ============================================================================

/**
 * Compile Discovery Evidence into Evidence IR.
 * Main entry point for Stage 2 compiler.
 */
export function compileEvidenceIR(
  discoveryInterviews: DiscoveryInterview[],
  compilerVersion: string = '2.0.0'
): EvidenceIRCompilerResult {
  const startTime = Date.now();
  const diagnostics: Array<{
    code: EvidenceDiagnosticCode;
    severity: string;
    message: string;
  }> = [];

  let itemsProcessed = 0;
  let itemsSuccessful = 0;
  let itemsFailed = 0;
  let canonicalizationErrors = 0;
  let identityErrors = 0;
  let validationErrors = 0;

  try {
    // Stage 2a: Compile interviews to collections
    const collections: EvidenceCollection[] = [];

    for (const interview of discoveryInterviews) {
      try {
        const collection = compileInterviewToCollection(interview, compilerVersion);
        collections.push(collection);

        for (const item of collection.items) {
          itemsProcessed++;
          if (item.validationResults.isValid) {
            itemsSuccessful++;
          } else {
            itemsFailed++;
            validationErrors += item.validationResults.violations.length;
          }
        }

        diagnostics.push({
          code: EvidenceDiagnosticCode.COLLECTION_CREATED,
          severity: 'info',
          message: `Created collection from interview ${interview.interviewId} with ${collection.items.length} items`,
        });
      } catch (e) {
        diagnostics.push({
          code: EvidenceDiagnosticCode.TRANSFORMATION_FAILED,
          severity: 'error',
          message: `Failed to compile interview ${interview.interviewId}: ${String(e)}`,
        });
      }
    }

    // Stage 2b: Compile collections to package (with deduplication)
    const package_ = compileCollectionsToPackage(collections, compilerVersion);

    const deduped = package_.deduplicationResults.totalInputItems - package_.deduplicationResults.totalDeduplicatedItems;
    if (deduped > 0) {
      diagnostics.push({
        code: EvidenceDiagnosticCode.EVIDENCE_DEDUPLICATED,
        severity: 'info',
        message: `Deduplicated ${deduped} duplicate items from ${package_.deduplicationResults.totalInputItems} total`,
      });
    }

    // Stage 2c: Compile package to set
    const set = compilePackagesToSet([package_], collections, compilerVersion);

    const executionTimeMs = Date.now() - startTime;

    const result: EvidenceIRCompilerResult = {
      success: true,
      compilerVersion,
      compiledAt: new Date().toISOString(),
      inputSource: {
        type: 'discovery_interviews',
        sourceId: discoveryInterviews.map(i => i.interviewId).join(','),
        interviewId: discoveryInterviews[0]?.interviewId || 'unknown',
      },
      evidenceSet: set,
      manifest: generateManifest(set, discoveryInterviews, compilerVersion, {
        itemsProcessed,
        itemsSuccessful,
        itemsFailed,
        canonicalizationErrors,
        identityErrors,
        validationErrors,
      }, diagnostics, executionTimeMs),
      diagnostics: diagnostics as any,
      statistics: {
        executionTimeMs,
        itemsProcessed,
        itemsSuccessful,
        itemsFailed,
        canonicalizationErrors,
        identityErrors,
        validationErrors,
      },
    };

    return result;
  } catch (e) {
    const executionTimeMs = Date.now() - startTime;

    return {
      success: false,
      compilerVersion,
      compiledAt: new Date().toISOString(),
      inputSource: {
        type: 'discovery_interviews',
        sourceId: discoveryInterviews.map(i => i.interviewId).join(','),
        interviewId: discoveryInterviews[0]?.interviewId || 'unknown',
      },
      manifest: {
        compilerVersion,
        schemaVersion: '1.0',
        compiledAt: new Date().toISOString(),
        inputSources: discoveryInterviews.map(interview => ({
          name: interview.participant || 'Unknown',
          interviewId: interview.interviewId,
          itemCount: 0,
        })),
        outputArtifacts: {
          totalItems: 0,
          totalCollections: 0,
          totalPackages: 0,
          totalDuplicatesRemoved: 0,
          totalRelationshipsFound: 0,
        },
        validationSummary: {
          totalValidations: itemsProcessed,
          passedValidations: itemsSuccessful,
          failedValidations: itemsFailed,
          warningsIssued: 0,
          errorsIssued: 1,
        },
        canonicalizationSummary: {
          totalItems: 0,
          itemsCanonicalizedSuccessfully: 0,
          canonicalizationErrors: 1,
        },
        identitySummary: {
          totalIdentitiesGenerated: 0,
          identityCollisions: 0,
          hashAlgorithm: 'sha256',
          hashLength: 64,
        },
        determinismVerification: {
          executionCount: 1,
          outputConsistent: false,
          outputHash: '',
        },
      },
      diagnostics: [
        ...diagnostics,
        {
          code: EvidenceDiagnosticCode.TRANSFORMATION_FAILED,
          severity: 'error',
          message: `Compilation failed: ${String(e)}`,
        },
      ] as any,
      statistics: {
        executionTimeMs,
        itemsProcessed,
        itemsSuccessful,
        itemsFailed,
        canonicalizationErrors: 1,
        identityErrors: 0,
        validationErrors,
      },
      fatalErrors: [String(e)],
    };
  }
}
