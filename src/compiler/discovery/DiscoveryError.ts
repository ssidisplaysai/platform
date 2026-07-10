export type DiscoveryErrorCode =
  | "PLUGIN_NOT_REGISTERED"
  | "UNSUPPORTED_EXTENSION"
  | "MISSING_SOURCE"
  | "PARSE_ERROR";

export class DiscoveryError extends Error {
  readonly code: DiscoveryErrorCode;
  readonly cause?: unknown;

  constructor(code: DiscoveryErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "DiscoveryError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export function isMissingSourceError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}
