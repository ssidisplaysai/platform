/**
 * IMPLEMENTS:
 * - GCS-0001 Stage 2 Evidence Compiler
 * - GPS-0001 Genesis Canonical Identity Standard
 * - EKM-1.0 Enterprise Knowledge Model
 */

import { createHash } from 'crypto';

export interface KnowledgeIdentityComponents {
  readonly canonicalContent: string;
  readonly sourceEvidenceId: string;
  readonly confidence: number;
  readonly entityIdentity?: string;
  readonly relationshipIdentity?: string;
  readonly temporalScope?: {
    readonly validFrom?: string;
    readonly validTo?: string | null;
    readonly observedAt?: string;
  };
  readonly lineage?: {
    readonly sourceEvidenceIds?: readonly string[];
    readonly transformationSteps?: readonly string[];
  };
  readonly version?: {
    readonly semver?: string;
    readonly revision?: number;
  };
}

/**
 * Knowledge Identity Generator
 *
 * Generates deterministic, content-addressed Knowledge IDs using GPS-0001 standard.
 *
 * Format: eko_<SHA-256-hash>_v<version>
 *
 * The hash is computed from the canonical content, ensuring:
 * - Same content always produces same ID
 * - Different content produces different ID
 * - Deterministic across all platforms and languages
 */
export class KnowledgeIdentity {
  /**
   * Knowledge ID prefix
   */
  static readonly PREFIX = 'eko';

  /**
   * Hash algorithm
   */
  static readonly ALGORITHM = 'sha256';

  /**
   * Knowledge ID version
   */
  static readonly VERSION = 1;

  /**
   * Hash length in characters (SHA-256 hex = 64 chars)
   */
  static readonly HASH_LENGTH = 64;

  /**
   * Generate deterministic Knowledge ID
   *
   * @param type - Knowledge type
   * @param canonicalContent - Canonical content (must be normalized)
   * @param sourceEvidenceId - Source evidence ID
   * @param confidence - Initial confidence [0, 1]
   * @returns Deterministic Knowledge ID (eko_<hash>_v1)
   */
  static generate(
    type: string,
    canonicalContent: string,
    sourceEvidenceId: string,
    confidence: number,
    components: KnowledgeIdentityComponents = {
      canonicalContent,
      sourceEvidenceId,
      confidence,
    }
  ): string {
    // Create canonical input for hashing
    const canonicalInput = JSON.stringify(
      {
        type,
        canonicalContent,
        sourceEvidenceId,
        confidence: Math.round(confidence * 100) / 100, // Normalize to 2 decimal places
        components: {
          canonicalContent: components.canonicalContent,
          sourceEvidenceId: components.sourceEvidenceId,
          confidence: Math.round(components.confidence * 100) / 100,
          entityIdentity: components.entityIdentity ?? null,
          relationshipIdentity: components.relationshipIdentity ?? null,
          temporalScope: components.temporalScope ?? null,
          lineage: components.lineage
            ? {
                sourceEvidenceIds: [...(components.lineage.sourceEvidenceIds ?? [])].sort(),
                transformationSteps: [...(components.lineage.transformationSteps ?? [])].sort(),
              }
            : null,
          version: components.version ?? null,
        },
      },
      null,
      0 // No pretty-printing for determinism
    );

    // Compute SHA-256 hash
    const hash = createHash(this.ALGORITHM).update(canonicalInput).digest('hex');

    // Format as GPS-0001 standard
    return `${this.PREFIX}_${hash}_v${this.VERSION}`;
  }

  /**
   * Parse a Knowledge ID
   *
   * @param id - Knowledge ID to parse
   * @returns Parsed components or null if invalid
   */
  static parse(id: string): { prefix: string; hash: string; version: number } | null {
    // Strict pattern: require exactly 64 hex characters, specific prefix and version
    const pattern = /^eko_([a-f0-9]{64})_v1$/;
    const match = id.match(pattern);

    if (!match) {
      return null;
    }

    const [, hash] = match;
    return {
      prefix: 'eko',
      hash,
      version: 1,
    };
  }

  /**
   * Validate Knowledge ID format
   *
   * @param id - Knowledge ID to validate
   * @returns True if valid format
   */
  static isValid(id: string): boolean {
    const parsed = this.parse(id);
    if (!parsed) {
      return false;
    }

    const { prefix, hash, version } = parsed;

    // Check components
    if (prefix !== this.PREFIX) {
      return false;
    }

    if (hash.length !== this.HASH_LENGTH) {
      return false;
    }

    if (version !== this.VERSION) {
      return false;
    }

    return true;
  }

  /**
   * Verify determinism of identity generation
   *
   * Runs generation multiple times to ensure identical IDs are produced.
   *
   * @param type - Knowledge type
   * @param canonicalContent - Canonical content
   * @param sourceEvidenceId - Source evidence ID
   * @param confidence - Initial confidence
   * @param runs - Number of times to run (default: 3)
   * @returns True if all runs produce identical IDs
   */
  static verifyDeterminism(
    type: string,
    canonicalContent: string,
    sourceEvidenceId: string,
    confidence: number,
    runs: number = 3
  ): boolean {
    const ids = new Set<string>();

    for (let i = 0; i < runs; i++) {
      const id = this.generate(type, canonicalContent, sourceEvidenceId, confidence);
      ids.add(id);
    }

    return ids.size === 1;
  }

  /**
   * Extract hash from Knowledge ID
   *
   * @param id - Knowledge ID
   * @returns Hash string or null if invalid
   */
  static extractHash(id: string): string | null {
    const parsed = this.parse(id);
    return parsed ? parsed.hash : null;
  }

  /**
   * Batch collision detection
   *
   * @param ids - Array of Knowledge IDs to check
   * @returns Array of duplicate IDs or empty if no duplicates
   */
  static detectCollisions(ids: string[]): string[] {
    const seen = new Map<string, number>();
    const duplicates: string[] = [];

    for (const id of ids) {
      const count = seen.get(id) || 0;
      seen.set(id, count + 1);

      if (count > 0 && !duplicates.includes(id)) {
        duplicates.push(id);
      }
    }

    return duplicates;
  }
}
