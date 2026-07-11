/**
 * GPS-0001 Identity Generator
 *
 * Generates deterministic, content-addressed identities per GPS-0001.
 * Format: <type_tag>_<hash_value>_v<version_tag>
 * All identities are:
 * • Deterministic (identical input → identical identity)
 * • Immutable (never change once assigned)
 * • Content-addressed (derived from normalized content)
 * • Stable (across platforms, languages, time)
 */

import { computeCanonicalHash } from '../canonicalization';

// ============================================================================
// Constants
// ============================================================================

const IDENTITY_VERSION = '1'; // Current version tag
const HASH_ALGORITHM = 'sha256';
const HASH_LENGTH = 64; // 256 bits in hex

/**
 * Stable type tags for all Evidence IR object types.
 * Per GPS-0001 section 8.2: Type tags are reserved and immutable.
 */
export const TypeTag = {
  EVIDENCE_ITEM: 'evidence_item',
  EVIDENCE_COLLECTION: 'evidence_collection',
  EVIDENCE_PACKAGE: 'evidence_package',
  EVIDENCE_SET: 'evidence_set',
} as const;

export type TypeTagValue = typeof TypeTag[keyof typeof TypeTag];

// ============================================================================
// Identity Generation
// ============================================================================

/**
 * Generate a deterministic identity for any Evidence IR object.
 * Per GPS-0001 section 8: Format is <type>_<hash>_v<version>
 *
 * @param typeTag Type of object (e.g., 'evidence_item')
 * @param content The object to derive identity from
 * @returns Identity string: e.g., "evidence_item_abc123...xyz_v1"
 */
export function generateIdentity(typeTag: string, content: unknown): string {
  // Validate type tag
  if (!typeTag || typeof typeTag !== 'string' || typeTag.length === 0) {
    throw new Error('Invalid type tag');
  }

  // Compute content hash (this canonicalizes the content)
  const hash = computeCanonicalHash(content);

  // Verify hash is correct length
  if (hash.length !== HASH_LENGTH) {
    throw new Error(`Hash length mismatch: expected ${HASH_LENGTH}, got ${hash.length}`);
  }

  // Format identity per GPS-0001 section 8.1
  const identity = `${typeTag}_${hash}_v${IDENTITY_VERSION}`;

  return identity;
}

/**
 * Generate identity for an Evidence Item.
 * Content includes: formType, rawContent, and provenance metadata.
 */
export function generateEvidenceItemIdentity(content: {
  formType: string;
  rawContent: string;
  provenance: {
    discoveryQuestionId: string;
    discoveryAnswerId: string;
  };
}): string {
  return generateIdentity(TypeTag.EVIDENCE_ITEM, content);
}

/**
 * Generate identity for an Evidence Collection.
 * Content includes: source interview ID and all item identities.
 */
export function generateEvidenceCollectionIdentity(content: {
  sourceInterviewId: string;
  itemIdentities: string[];
}): string {
  return generateIdentity(TypeTag.EVIDENCE_COLLECTION, content);
}

/**
 * Generate identity for an Evidence Package.
 * Content includes: source collections and all item identities.
 */
export function generateEvidencePackageIdentity(content: {
  sourceCollectionIds: string[];
  itemIdentities: string[];
}): string {
  return generateIdentity(TypeTag.EVIDENCE_PACKAGE, content);
}

/**
 * Generate identity for an Evidence Set.
 * Content includes: all collections, packages, and global metadata.
 */
export function generateEvidenceSetIdentity(content: {
  collectionIds: string[];
  packageIds: string[];
  totalItems: number;
}): string {
  return generateIdentity(TypeTag.EVIDENCE_SET, content);
}

// ============================================================================
// Identity Validation
// ============================================================================

/**
 * Parse an identity string per GPS-0001 section 8.1.
 * Format: <type>_<hash>_v<version>
 */
export function parseIdentity(identity: string): {
  typeTag: string;
  hash: string;
  version: string;
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!identity || typeof identity !== 'string') {
    return { typeTag: '', hash: '', version: '', isValid: false, errors: ['Identity must be non-empty string'] };
  }

  // Match pattern: <type>_<hash>_v<version>
  const match = identity.match(/^([a-z_]+)_([a-f0-9]+)_v(\d+)$/);

  if (!match) {
    errors.push(`Identity does not match required format: ${identity}`);
    return { typeTag: '', hash: '', version: '', isValid: false, errors };
  }

  const [, typeTag, hash, version] = match;

  // Validate components
  if (!typeTag) {
    errors.push('Type tag is empty');
  }

  if (hash.length !== HASH_LENGTH) {
    errors.push(`Hash length invalid: expected ${HASH_LENGTH}, got ${hash.length}`);
  }

  if (!version) {
    errors.push('Version is empty');
  }

  return {
    typeTag,
    hash,
    version,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Verify that an identity is valid for given content.
 * Per GPS-0001 section 16: Validation algorithm.
 */
export function verifyIdentity(identity: string, typeTag: string, content: unknown): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Parse identity
  const parsed = parseIdentity(identity);
  if (!parsed.isValid) {
    errors.push(...parsed.errors);
    return { isValid: false, errors };
  }

  // Verify type tag matches
  if (parsed.typeTag !== typeTag) {
    errors.push(`Type tag mismatch: identity has '${parsed.typeTag}', expected '${typeTag}'`);
  }

  // Verify version is current (v1)
  if (parsed.version !== IDENTITY_VERSION) {
    errors.push(`Version mismatch: identity has 'v${parsed.version}', expected 'v${IDENTITY_VERSION}'`);
  }

  // Recompute hash and verify
  const computedHash = computeCanonicalHash(content);
  if (computedHash !== parsed.hash) {
    errors.push(`Hash mismatch: content hashes to '${computedHash}', identity has '${parsed.hash}'`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Extract hash from identity.
 * Useful for deduplication and indexing.
 */
export function getHashFromIdentity(identity: string): string | null {
  const parsed = parseIdentity(identity);
  return parsed.isValid ? parsed.hash : null;
}

/**
 * Get type tag from identity.
 */
export function getTypeTagFromIdentity(identity: string): string | null {
  const parsed = parseIdentity(identity);
  return parsed.isValid ? parsed.typeTag : null;
}

// ============================================================================
// Determinism Verification
// ============================================================================

/**
 * Verify identity generation is deterministic.
 * Per GPS-0001 section 6: Run multiple times, verify all produce identical result.
 */
export function verifyDeterminism(typeTag: string, content: unknown, runs: number = 5): {
  isDeterministic: boolean;
  identities: string[];
  errors: string[];
} {
  const identities: string[] = [];
  const errors: string[] = [];

  try {
    for (let i = 0; i < runs; i++) {
      const identity = generateIdentity(typeTag, content);
      identities.push(identity);
    }

    // Check all identities are identical
    const firstIdentity = identities[0];
    const allIdentical = identities.every(id => id === firstIdentity);

    if (!allIdentical) {
      errors.push(`Non-deterministic identity generation detected`);
      for (let i = 0; i < identities.length; i++) {
        if (identities[i] !== firstIdentity) {
          errors.push(`Run ${i + 1}: ${identities[i]} (expected ${firstIdentity})`);
        }
      }
    }

    return {
      isDeterministic: allIdentical,
      identities: allIdentical ? [firstIdentity] : identities,
      errors,
    };
  } catch (e) {
    errors.push(`Determinism verification failed: ${String(e)}`);
    return {
      isDeterministic: false,
      identities,
      errors,
    };
  }
}

// ============================================================================
// Identity Collision Detection
// ============================================================================

/**
 * Detect identity collisions in a list of objects.
 * Per GPS-0001 section 7: Collision probability should be negligible.
 */
export function detectCollisions(
  items: Array<{ typeTag: string; content: unknown; id?: string }>
): {
  hasCollisions: boolean;
  collisions: Array<{
    identity: string;
    itemIndices: number[];
    count: number;
  }>;
} {
  const identityMap = new Map<string, number[]>();

  for (let i = 0; i < items.length; i++) {
    const { typeTag, content } = items[i];
    const identity = generateIdentity(typeTag, content);

    if (!identityMap.has(identity)) {
      identityMap.set(identity, []);
    }
    identityMap.get(identity)!.push(i);
  }

  const collisions = Array.from(identityMap.entries())
    .filter(([, indices]) => indices.length > 1)
    .map(([identity, indices]) => ({
      identity,
      itemIndices: indices,
      count: indices.length,
    }));

  return {
    hasCollisions: collisions.length > 0,
    collisions,
  };
}
