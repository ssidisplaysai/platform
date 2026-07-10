/**
 * Evidence IR JSON Exporters
 *
 * Generate deterministic, validated JSON artifacts for Evidence IR objects.
 * Per GPS-0002: All output is in canonical JSON format (compact, sorted keys).
 */

import {
  EvidenceItem,
  EvidenceCollection,
  EvidencePackage,
  EvidenceSet,
  EvidenceManifest,
  EvidenceIRCompilerResult,
} from '../models';
import { canonicalizeToJSON } from '../canonicalization';

// ============================================================================
// JSON Export Configuration
// ============================================================================

interface ExportOptions {
  /**
   * Pretty-print JSON with indentation (for readability).
   * Default: false (compact, deterministic)
   */
  prettyPrint?: boolean;

  /**
   * Include provenance details.
   * Default: true
   */
  includeprovenance?: boolean;

  /**
   * Include diagnostics.
   * Default: true
   */
  includeDiagnostics?: boolean;

  /**
   * Include metadata.
   * Default: true
   */
  includeMetadata?: boolean;
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export an Evidence Item to JSON.
 */
export function exportEvidenceItem(item: EvidenceItem, options: ExportOptions = {}): string {
  const canonical = canonicalizeToJSON(item);
  return options.prettyPrint ? JSON.stringify(JSON.parse(canonical), null, 2) : canonical;
}

/**
 * Export an Evidence Collection to JSON.
 */
export function exportEvidenceCollection(collection: EvidenceCollection, options: ExportOptions = {}): string {
  const canonical = canonicalizeToJSON(collection);
  return options.prettyPrint ? JSON.stringify(JSON.parse(canonical), null, 2) : canonical;
}

/**
 * Export an Evidence Package to JSON.
 */
export function exportEvidencePackage(pkg: EvidencePackage, options: ExportOptions = {}): string {
  const canonical = canonicalizeToJSON(pkg);
  return options.prettyPrint ? JSON.stringify(JSON.parse(canonical), null, 2) : canonical;
}

/**
 * Export an Evidence Set to JSON.
 */
export function exportEvidenceSet(set: EvidenceSet, options: ExportOptions = {}): string {
  const canonical = canonicalizeToJSON(set);
  return options.prettyPrint ? JSON.stringify(JSON.parse(canonical), null, 2) : canonical;
}

/**
 * Export a Manifest to JSON.
 */
export function exportManifest(manifest: EvidenceManifest, options: ExportOptions = {}): string {
  const canonical = canonicalizeToJSON(manifest);
  return options.prettyPrint ? JSON.stringify(JSON.parse(canonical), null, 2) : canonical;
}

/**
 * Export a Compiler Result to JSON.
 */
export function exportCompilerResult(result: EvidenceIRCompilerResult, options: ExportOptions = {}): string {
  const canonical = canonicalizeToJSON(result);
  return options.prettyPrint ? JSON.stringify(JSON.parse(canonical), null, 2) : canonical;
}

// ============================================================================
// Summary Export Functions
// ============================================================================

/**
 * Export Evidence Items as a summary array (identities + counts).
 */
export function exportEvidenceItemsSummary(items: EvidenceItem[]): string {
  const summary = items.map(item => ({
    identity: item.metadata.identity,
    formType: item.formType,
    contentLength: item.content.length,
    hasRelationships: item.relationships?.relatedItemIds?.length > 0,
    isValid: item.validationResults.isValid,
  }));

  const canonical = canonicalizeToJSON(summary);
  return canonical;
}

/**
 * Export all Evidence Items from collection to JSON lines format.
 * Each line is a complete, valid JSON object.
 */
export function exportEvidenceItemsJsonLines(items: EvidenceItem[]): string {
  const lines = items.map(item => canonicalizeToJSON(item));
  return lines.join('\n');
}

// ============================================================================
// Multi-source Export
// ============================================================================

/**
 * Export multiple Evidence Packages for different sources.
 * Useful for comparing outputs from different interviews.
 */
export function exportMultiSourceComparison(
  packages: Array<{ sourceName: string; pkg: EvidencePackage }>
): string {
  const comparison = packages.map(({ sourceName, pkg }) => ({
    source: sourceName,
    packageIdentity: pkg.metadata.identity,
    itemCount: pkg.items.length,
    statistics: {
      totalInput: pkg.deduplicationResults.totalInputItems,
      afterDeduplication: pkg.deduplicationResults.totalDeduplicatedItems,
      duplicatesRemoved: pkg.deduplicationResults.totalInputItems - pkg.deduplicationResults.totalDeduplicatedItems,
      formTypeDistribution: pkg.items.reduce(
        (dist, item) => {
          dist[item.formType] = (dist[item.formType] || 0) + 1;
          return dist;
        },
        {} as Record<string, number>
      ),
    },
  }));

  const canonical = canonicalizeToJSON(comparison);
  return canonical;
}

// ============================================================================
// Batch Export
// ============================================================================

/**
 * Export all artifacts produced by compiler in a structured way.
 */
export interface ExportedArtifacts {
  manifest: string;
  compilerResult: string;
  evidenceSet: string;
  collections: Array<{ sourceName: string; json: string }>;
  packages: Array<{ sourceName: string; json: string }>;
  summary: {
    totalItems: number;
    totalCollections: number;
    totalPackages: number;
    exportTimestamp: string;
  };
}

export function exportAllArtifacts(result: EvidenceIRCompilerResult): ExportedArtifacts {
  const collections = (result.evidenceSet?.collections || []).map((collection, index) => ({
    sourceName: collection.sourceParticipant.name || `Collection_${index}`,
    json: exportEvidenceCollection(collection),
  }));

  const packages = (result.evidenceSet?.packages || []).map((pkg, index) => ({
    sourceName: `Package_${index}`,
    json: exportEvidencePackage(pkg),
  }));

  return {
    manifest: exportManifest(result.manifest),
    compilerResult: exportCompilerResult(result),
    evidenceSet: result.evidenceSet ? exportEvidenceSet(result.evidenceSet) : '',
    collections,
    packages,
    summary: {
      totalItems: result.evidenceSet?.allItems.length || 0,
      totalCollections: result.evidenceSet?.collections.length || 0,
      totalPackages: result.evidenceSet?.packages.length || 0,
      exportTimestamp: new Date().toISOString(),
    },
  };
}
