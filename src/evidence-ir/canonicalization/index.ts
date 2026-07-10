/**
 * GPS-0002 Canonicalization Engine
 *
 * Transforms diverse input representations into canonical form per GPS-0002.
 * All canonicalization rules are deterministic and platform-independent.
 */

import * as crypto from 'crypto';

// ============================================================================
// Character & Encoding Normalization
// ============================================================================

/**
 * Normalize text to NFC (Canonical Composition) form per GPS-0002 section 5.2.
 * Also normalizes line endings and whitespace per GPS-0002 section 5.
 */
export function normalizeText(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // 1. Normalize Unicode to NFC (Canonical Composition)
  let normalized = input.normalize('NFC');

  // 2. Normalize line endings to LF only (per GPS-0002 section 5.3)
  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Strip leading and trailing whitespace (per GPS-0002 section 5.4)
  normalized = normalized.trim();

  // 4. Normalize internal tabs to spaces (per GPS-0002 section 5.4)
  normalized = normalized.replace(/\t/g, ' ');

  // 5. Normalize quote characters to ASCII (per GPS-0002 section 6.1.3)
  normalized = normalized
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u00AB\u00BB]/g, '"'); // Guillemets

  return normalized;
}

/**
 * Canonicalize a string value (identifier or label).
 * Per GPS-0002 section 6.1: normalize case to lowercase for identifiers.
 */
export function canonicalizeIdentifier(input: string): string {
  let canonical = normalizeText(input);
  
  // Convert to lowercase
  canonical = canonical.toLowerCase();
  
  // Replace hyphens, dots, spaces with underscores
  canonical = canonical
    .replace(/[-.\s]+/g, '_') // Replace separators with underscore
    .replace(/_+/g, '_') // Collapse consecutive underscores
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  
  return canonical;
}

/**
 * Canonicalize a numeric value per GPS-0002 section 6.2.
 */
export function canonicalizeNumber(input: unknown): string {
  if (input === null || input === undefined) return 'null';
  
  const num = Number(input);
  if (isNaN(num)) return '';
  
  // Check if it's an integer or decimal
  if (Number.isInteger(num)) {
    return num.toString();
  }
  
  // For decimals, use string representation and trim trailing zeros
  let str = num.toString();
  if (str.includes('e') || str.includes('E')) {
    // Handle scientific notation by converting to decimal
    return Number(num).toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
  }
  
  // Trim trailing zeros after decimal point
  if (str.includes('.')) {
    str = str.replace(/0+$/, '').replace(/\.$/, '');
  }
  
  return str;
}

/**
 * Canonicalize a boolean value per GPS-0002 section 6.3.
 */
export function canonicalizeBoolean(input: unknown): string {
  if (typeof input === 'boolean') {
    return input ? 'true' : 'false';
  }
  
  if (typeof input === 'string') {
    const lower = input.toLowerCase();
    if (lower === 'true' || lower === 'yes' || lower === '1') return 'true';
    if (lower === 'false' || lower === 'no' || lower === '0') return 'false';
  }
  
  return '';
}

/**
 * Canonicalize a datetime value to ISO 8601 UTC per GPS-0002 section 7.
 */
export function canonicalizeDateTime(input: unknown): string {
  if (!input) return 'null';
  
  try {
    const date = new Date(input as string | number);
    if (isNaN(date.getTime())) return '';
    
    // Format as ISO 8601 UTC
    return date.toISOString();
  } catch {
    return '';
  }
}

/**
 * Canonicalize a null or missing value per GPS-0002 section 6.4.
 */
export function canonicalizeNull(input: unknown): string {
  if (input === null || input === undefined) return 'null';
  if (input === '') return '""'; // Empty string is not null
  if (Array.isArray(input) && input.length === 0) return '[]'; // Empty array
  if (typeof input === 'object' && Object.keys(input).length === 0) return '{}'; // Empty object
  return '';
}

// ============================================================================
// Collection Canonicalization
// ============================================================================

/**
 * Canonicalize a set (unordered collection with deduplication).
 * Per GPS-0002 section 9.2: remove duplicates and sort lexicographically.
 */
export function canonicalizeSet(items: unknown[]): unknown[] {
  if (!Array.isArray(items)) return [];
  
  // Convert each item to string for comparison
  const seen = new Set<string>();
  const unique: unknown[] = [];
  
  for (const item of items) {
    const str = JSON.stringify(item);
    if (!seen.has(str)) {
      seen.add(str);
      unique.push(item);
    }
  }
  
  // Sort lexicographically
  return unique.sort((a, b) => {
    const strA = JSON.stringify(a);
    const strB = JSON.stringify(b);
    return strA.localeCompare(strB);
  });
}

/**
 * Canonicalize a list (ordered collection).
 * Per GPS-0002 section 9.3: preserve order, remove consecutive duplicates only.
 */
export function canonicalizeList(items: unknown[]): unknown[] {
  if (!Array.isArray(items)) return [];
  
  // Remove consecutive duplicates
  const result: unknown[] = [];
  let lastStr = '';
  
  for (const item of items) {
    const str = JSON.stringify(item);
    if (str !== lastStr) {
      result.push(item);
      lastStr = str;
    }
  }
  
  return result;
}

/**
 * Canonicalize an object/dictionary per GPS-0002 section 9.4.
 * Sort keys lexicographically.
 */
export function canonicalizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null) return {};
  
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();
  
  for (const key of keys) {
    sorted[key] = canonicalizeValue(obj[key]);
  }
  
  return sorted;
}

/**
 * Canonicalize any value based on its type.
 * Master dispatcher for all canonicalization rules.
 */
export function canonicalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'string') {
    return normalizeText(value);
  }
  
  if (typeof value === 'number') {
    return canonicalizeNumber(value);
  }
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (Array.isArray(value)) {
    return canonicalizeList(value);
  }
  
  if (typeof value === 'object') {
    return canonicalizeObject(value as Record<string, unknown>);
  }
  
  return value;
}

// ============================================================================
// JSON Canonicalization
// ============================================================================

/**
 * Canonicalize a JSON object to deterministic string form per GPS-0002 section 12.
 * Produces compact JSON with:
 * • No extraneous whitespace
 * • Keys sorted lexicographically
 * • Consistent encoding
 * • Deterministic field ordering
 */
export function canonicalizeToJSON(obj: unknown): string {
  // First canonicalize the object
  const canonical = canonicalizeValue(obj);
  
  // Then serialize to compact JSON (no whitespace)
  return JSON.stringify(canonical, null, 0);
}

/**
 * Parse canonical JSON and canonicalize again.
 * Useful for verification and re-canonicalization.
 */
export function verifyCanonicalForm(json: string): { isCanonical: boolean; canonical: string; error?: string } {
  try {
    const parsed = JSON.parse(json);
    const canonical = canonicalizeToJSON(parsed);
    return {
      isCanonical: json === canonical,
      canonical,
    };
  } catch (e) {
    return {
      isCanonical: false,
      canonical: '',
      error: String(e),
    };
  }
}

// ============================================================================
// Canonicalization Hash (for identity generation)
// ============================================================================

/**
 * Compute SHA-256 hash of canonical form per GPS-0001 section 7.
 * Used for content-addressed identity generation.
 * Result is lowercase hex string (64 characters).
 */
export function computeCanonicalHash(obj: unknown): string {
  const canonical = canonicalizeToJSON(obj);
  const hash = crypto.createHash('sha256');
  hash.update(canonical, 'utf8');
  return hash.digest('hex');
}

/**
 * Verify hash matches canonical form.
 */
export function verifyCanonicalHash(obj: unknown, expectedHash: string): boolean {
  const computed = computeCanonicalHash(obj);
  return computed === expectedHash;
}
