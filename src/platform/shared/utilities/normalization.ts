/**
 * Supported input: string.
 * Output is deterministic and may be lossy because leading/trailing whitespace
 * and letter casing are normalized.
 * Caller responsibility: use only for identifiers whose canonical semantics are
 * case-insensitive and trim-insensitive.
 */
export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Supported input: string.
 * Output is deterministic and may be lossy because repeated whitespace and line
 * breaks are collapsed to single spaces.
 * Caller responsibility: avoid using this helper for content where exact
 * whitespace shape is semantically meaningful.
 */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Supported input: JSON-serializable payloads only.
 * Unsupported input examples: functions, symbols, bigint, cyclic references,
 * class instances requiring prototype behavior.
 * Output is deterministic for JSON-compatible values but lossy for unsupported
 * or richer runtime types (e.g., Date serialized to string).
 * Caller responsibility: use only when JSON payload semantics are the intended
 * persistence/interchange contract.
 */
export function normalizeJson<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T;
}
