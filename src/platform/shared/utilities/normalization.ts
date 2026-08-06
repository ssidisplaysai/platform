export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeJson<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T;
}
