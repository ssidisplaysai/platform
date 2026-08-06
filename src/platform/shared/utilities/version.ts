export function isSemverVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

export function assertVersion(value: string, label: string): void {
  if (!isSemverVersion(value)) {
    throw new Error(`invalid ${label} version: ${value}`);
  }
}
