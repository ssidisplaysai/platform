import { SourceHash } from "@/compiler/provenance/SourceHash";

export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

function normalizeCanonicalValue(value: unknown): CanonicalJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical content cannot contain non-finite numbers.");
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeCanonicalValue(entry));
  }
  if (typeof value === "object") {
    const normalized: Record<string, CanonicalJsonValue> = {};
    Object.keys(value as Record<string, unknown>)
      .sort()
      .forEach((key) => {
        const entry = (value as Record<string, unknown>)[key];
        if (entry !== undefined) normalized[key] = normalizeCanonicalValue(entry);
      });
    return normalized;
  }
  throw new TypeError(`Unsupported canonical content value: ${typeof value}.`);
}

export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(normalizeCanonicalValue(value));
}

export function createCanonicalContentHash(value: unknown): string {
  return SourceHash.sha256(canonicalSerialize(value));
}