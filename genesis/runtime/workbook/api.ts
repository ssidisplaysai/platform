import type { GoogleWorkbookMetadata } from "../../adapters/google-sheets";

export interface WorkbookCompileApiRequest {
  readonly runId?: string;
  readonly workbook?: GoogleWorkbookMetadata;
}

export interface WorkbookCompileApiArtifact {
  readonly type: "WorkbookInventory";
  readonly sha256: string;
}

export interface WorkbookCompileApiSuccessResponse {
  readonly success: true;
  readonly runId: string;
  readonly manifest: unknown;
  readonly inventory: unknown;
  readonly artifact: WorkbookCompileApiArtifact;
}

export interface WorkbookCompileApiErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export interface WorkbookRuntimeConfig {
  readonly apiKey: string;
  readonly artifactRoot: string;
  readonly maximumRequestBytes: number;
}

export function readBearerToken(
  authorizationHeader: string | null,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

export function resolveWorkbookRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): WorkbookRuntimeConfig {
  const apiKey = environment.GENESIS_RUNTIME_API_KEY?.trim();
  const artifactRoot = environment.GENESIS_ARTIFACT_ROOT?.trim();

  if (!apiKey) {
    throw new Error(
      "GENESIS_RUNTIME_API_KEY is not configured.",
    );
  }

  if (!artifactRoot) {
    throw new Error(
      "GENESIS_ARTIFACT_ROOT is not configured.",
    );
  }

  const configuredLimit = Number(
    environment.GENESIS_RUNTIME_MAX_REQUEST_BYTES ?? 1048576,
  );

  const maximumRequestBytes =
    Number.isFinite(configuredLimit) && configuredLimit > 0
      ? configuredLimit
      : 1048576;

  return {
    apiKey,
    artifactRoot,
    maximumRequestBytes,
  };
}

export function validateWorkbookCompileApiRequest(
  value: unknown,
): WorkbookCompileApiRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const request = value as WorkbookCompileApiRequest;

  if (!request.workbook) {
    throw new Error(
      "Request body must include workbook metadata.",
    );
  }

  return request;
}
