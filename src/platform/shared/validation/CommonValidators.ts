export function assertRequiredString(value: unknown, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`required string missing: ${field}`);
  }
}

export function assertArray(value: unknown, field: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`required array missing: ${field}`);
  }
}

export function assertObject(value: unknown, field: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`required object missing: ${field}`);
  }
}
