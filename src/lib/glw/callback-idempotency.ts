import { createHash } from "node:crypto";
import type { GlwPageGenerationCallbackPayload } from "./jobs";

export const GLW_TERMINAL_CALLBACK_TYPE = "PAGE_GENERATION_TERMINAL" as const;

const CALLBACK_IDENTITY_FIELDS = new Set([
  "callbackVersion",
  "operationKey",
  "idempotencyKey",
  "terminalScopeKey",
  "callbackType",
  "payloadSha256",
]);

type JsonPrimitive = string | number | boolean | null;
type CanonicalJson = JsonPrimitive | CanonicalJson[] | { [key: string]: CanonicalJson };

export type GlwCallbackIdentity = {
  mode: "V1" | "V2";
  operationKey: string;
  idempotencyKey: string;
  terminalScopeKey: string;
  callbackType: typeof GLW_TERMINAL_CALLBACK_TYPE;
  payloadSha256: string;
  canonicalPayload: Record<string, CanonicalJson>;
};

export class GlwCallbackIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GlwCallbackIdentityError";
  }
}

function canonicalize(value: unknown): CanonicalJson {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new GlwCallbackIdentityError("Callback payload contains a non-finite number.");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  throw new GlwCallbackIdentityError("Callback payload contains an unsupported value.");
}

export function canonicalizeGlwCallbackPayload(payload: GlwPageGenerationCallbackPayload): Record<string, CanonicalJson> {
  const semanticPayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !CALLBACK_IDENTITY_FIELDS.has(key)),
  );

  return canonicalize(semanticPayload) as Record<string, CanonicalJson>;
}

export function hashCanonicalGlwCallbackPayload(payload: GlwPageGenerationCallbackPayload): {
  canonicalPayload: Record<string, CanonicalJson>;
  payloadSha256: string;
} {
  const canonicalPayload = canonicalizeGlwCallbackPayload(payload);
  const payloadSha256 = createHash("sha256").update(JSON.stringify(canonicalPayload), "utf8").digest("hex");
  return { canonicalPayload, payloadSha256 };
}

export function deriveGlwCallbackIdentity(payload: GlwPageGenerationCallbackPayload): GlwCallbackIdentity {
  const { canonicalPayload, payloadSha256 } = hashCanonicalGlwCallbackPayload(payload);
  const hasV2Identity = Boolean(
    payload.callbackVersion
    || payload.operationKey
    || payload.idempotencyKey
    || payload.terminalScopeKey
    || payload.callbackType
    || payload.payloadSha256,
  );

  if (!hasV2Identity) {
    const operationKey = `glw-legacy-op-v1:${payload.jobId}`;
    return {
      mode: "V1",
      operationKey,
      idempotencyKey: `glw-callback-v1:${operationKey}:${payload.jobId}:${payload.executionId}:${GLW_TERMINAL_CALLBACK_TYPE}:${payload.status}`,
      terminalScopeKey: `glw-terminal-v1:${operationKey}:${payload.jobId}:${payload.executionId}:${GLW_TERMINAL_CALLBACK_TYPE}`,
      callbackType: GLW_TERMINAL_CALLBACK_TYPE,
      payloadSha256,
      canonicalPayload,
    };
  }

  const operationKey = payload.operationKey?.trim() ?? "";
  const callbackType = payload.callbackType?.trim() ?? "";
  if (payload.callbackVersion !== "2" || !operationKey || callbackType !== GLW_TERMINAL_CALLBACK_TYPE || !payload.payloadSha256) {
    throw new GlwCallbackIdentityError("Version 2 callback identity fields are incomplete or unsupported.");
  }

  const expectedIdempotencyKey = `glw-callback-v2:${operationKey}:${payload.jobId}:${payload.executionId}:${GLW_TERMINAL_CALLBACK_TYPE}:${payload.status}`;
  const expectedTerminalScopeKey = `glw-terminal-v2:${operationKey}:${payload.jobId}:${payload.executionId}:${GLW_TERMINAL_CALLBACK_TYPE}`;
  if (payload.idempotencyKey !== expectedIdempotencyKey || payload.terminalScopeKey !== expectedTerminalScopeKey) {
    throw new GlwCallbackIdentityError("Version 2 callback identity does not match the receiver-derived identity.");
  }
  if (payload.payloadSha256.toLowerCase() !== payloadSha256) {
    throw new GlwCallbackIdentityError("Version 2 callback payload hash does not match the canonical payload.");
  }

  return {
    mode: "V2",
    operationKey,
    idempotencyKey: expectedIdempotencyKey,
    terminalScopeKey: expectedTerminalScopeKey,
    callbackType: GLW_TERMINAL_CALLBACK_TYPE,
    payloadSha256,
    canonicalPayload,
  };
}