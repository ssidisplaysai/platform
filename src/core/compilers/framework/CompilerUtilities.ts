/**
 * Genesis Compiler Framework - Utilities
 *
 * Helper functions for metadata, checksums, and identity generation
 */

import * as crypto from "crypto";
import {
  ArtifactChecksum,
  ArtifactIdentity,
  ArtifactVersion,
} from "./types";

/**
 * Create deterministic checksum for artifact
 *
 * Uses SHA256 of canonical JSON representation
 */
export function createChecksum(
  content: any,
  algorithm: "SHA256" = "SHA256"
): ArtifactChecksum {
  const canonical = stableStringify(content);
  const hash = crypto.createHash("sha256").update(canonical).digest("hex");

  return {
    algorithm,
    value: hash,
  };
}

/**
 * Create deterministic artifact identity
 *
 * Format: prefix_hash_v1
 * Example: BGC_abc123_v1
 */
export function createArtifactIdentity(
  prefix: string,
  content: any,
  schemaVersion: string = "v1"
): ArtifactIdentity {
  const canonical = stableStringify(content);
  const hash = crypto.createHash("sha256").update(canonical).digest("hex");

  // Take first 16 chars of hash
  const shortHash = hash.substring(0, 16);

  return {
    id: `${prefix}_${shortHash}_${schemaVersion}`,
    prefix,
    hash: shortHash,
    schemaVersion,
  };
}

/**
 * Parse semantic version string
 *
 * Formats: "1.0.0", "1.0.0-alpha", "1.0.0-beta.1"
 */
export function parseArtifactVersion(versionString: string): ArtifactVersion {
  const match = versionString.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?$/
  );

  if (!match) {
    throw new Error(
      `Invalid version string: ${versionString}. Expected format: X.Y.Z or X.Y.Z-prerelease`
    );
  }

  const [, major, minor, patch, prerelease] = match;

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease: prerelease || undefined,
    toString() {
      const base = `${this.major}.${this.minor}.${this.patch}`;
      return this.prerelease ? `${base}-${this.prerelease}` : base;
    },
  };
}

/**
 * Create artifact version object
 */
export function createArtifactVersion(
  major: number,
  minor: number,
  patch: number,
  prerelease?: string
): ArtifactVersion {
  return {
    major,
    minor,
    patch,
    prerelease,
    toString() {
      const base = `${major}.${minor}.${patch}`;
      return prerelease ? `${base}-${prerelease}` : base;
    },
  };
}

/**
 * Stable JSON stringify for deterministic hashing
 *
 * Uses alphabetically sorted keys to ensure identical output
 * for logically identical objects
 */
export function stableStringify(obj: any): string {
  const seen = new WeakSet();

  return JSON.stringify(obj, (key, value) => {
    // Handle circular references
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }

    // Sort object keys for determinism
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const sortedKeys = Object.keys(value).sort();
      const sorted: Record<string, any> = {};

      for (const k of sortedKeys) {
        sorted[k] = value[k];
      }

      return sorted;
    }

    return value;
  });
}

/**
 * Get current ISO timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Sleep for specified milliseconds
 *
 * Used in async operations and testing
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Freeze object recursively
 *
 * Ensures object is truly immutable
 */
export function deepFreeze<T>(obj: T): T {
  Object.freeze(obj);

  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if (
      obj[prop as keyof T] !== null &&
      (typeof obj[prop as keyof T] === "object" ||
        typeof obj[prop as keyof T] === "function") &&
      !Object.isFrozen(obj[prop as keyof T])
    ) {
      deepFreeze(obj[prop as keyof T]);
    }
  });

  return obj;
}

/**
 * Verify object has not been modified (by comparison with frozen copy)
 */
export function verifyNotModified<T>(original: T, current: T): boolean {
  const originalJson = stableStringify(original);
  const currentJson = stableStringify(current);
  return originalJson === currentJson;
}

/**
 * Create a deep copy of an object
 *
 * Uses JSON serialization (works for JSON-serializable objects)
 */
export function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
