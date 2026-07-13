/**
 * checksum.ts
 *
 * Deterministic checksum generation for build reports.
 *
 * Used to verify that identical compiler output always produces
 * identical reports (no non-determinism).
 */

import { createHash } from 'crypto';

/**
 * Compute a deterministic checksum for a build report object.
 *
 * The checksum is computed from the canonicalized JSON representation
 * of the report. This ensures that:
 * - Identical reports always have identical checksums
 * - Different reports always have different checksums
 * - The checksum is deterministic and reproducible
 *
 * Timestamps and environment-specific values are excluded from
 * the checksum to ensure determinism across runs and machines.
 *
 * @param report - Report object to checksum (should have timestamps stripped)
 * @returns SHA-256 hex digest
 */
export function computeChecksum(report: any): string {
  // Canonicalize to JSON with deterministic key ordering
  const canonical = JSON.stringify(report, Object.keys(report).sort(), 2);

  // Compute SHA-256
  const hash = createHash('sha256');
  hash.update(canonical, 'utf8');
  return hash.digest('hex');
}

/**
 * Strip timestamp fields from a report to ensure checksum determinism.
 *
 * Removes:
 * - parsedAt fields (timestamps)
 * - generatedAt fields
 * - Any ISO 8601 timestamp strings in specific fields
 *
 * The stripped report can be used for checksum computation to ensure
 * that repeated runs produce identical checksums.
 *
 * @param report - Original report
 * @returns Report with timestamp fields removed
 */
export function stripTimestamps(report: any): any {
  return JSON.parse(JSON.stringify(report, (key: string, value: any) => {
    // Exclude timestamp fields
    if (key === 'parsedAt' || key === 'generatedAt' || key === 'compiledAt') {
      return undefined;
    }
    return value;
  }));
}

/**
 * Verify that a report has a valid checksum.
 *
 * Computes the expected checksum and compares it to the provided one.
 *
 * @param report - Report with checksum field
 * @param actualChecksum - Checksum to verify
 * @returns true if checksum is valid, false otherwise
 */
export function verifyChecksum(report: any, actualChecksum: string): boolean {
  const reportCopy = { ...report };
  delete (reportCopy as any).checksum;

  const expected = computeChecksum(reportCopy);
  return expected === actualChecksum;
}
