import { randomUUID } from "node:crypto";
import {
  deriveGlwCallbackIdentity,
  GLW_TERMINAL_CALLBACK_TYPE,
  hashCanonicalGlwCallbackPayload,
} from "./callback-idempotency";
import type { GlwPageGenerationCallbackPayload } from "./jobs";

export type GlwProducerOperationIdentity = {
  operationKey: string;
  publicationKey: string;
};

export type GlwProducerTerminalPayload = GlwPageGenerationCallbackPayload & {
  callbackVersion: "2";
  operationKey: string;
  idempotencyKey: string;
  terminalScopeKey: string;
  callbackType: typeof GLW_TERMINAL_CALLBACK_TYPE;
  payloadSha256: string;
};

export function createGlwProducerOperationIdentity(
  existing?: Partial<GlwProducerOperationIdentity>,
  createUuid: () => string = randomUUID,
): GlwProducerOperationIdentity {
  return {
    operationKey: existing?.operationKey ?? `glw-op-v1:${createUuid()}`,
    publicationKey: existing?.publicationKey ?? `glw-publication-v1:${createUuid()}`,
  };
}

export function buildGlwProducerTerminalPayload(
  semanticPayload: GlwPageGenerationCallbackPayload,
  operationKey: string,
): GlwProducerTerminalPayload {
  const normalizedOperationKey = operationKey.trim();
  if (!normalizedOperationKey) {
    throw new Error("Producer operation identity is required.");
  }

  const identityEnvelope = {
    ...semanticPayload,
    callbackVersion: "2" as const,
    operationKey: normalizedOperationKey,
    callbackType: GLW_TERMINAL_CALLBACK_TYPE,
    idempotencyKey: `glw-callback-v2:${normalizedOperationKey}:${semanticPayload.jobId}:${semanticPayload.executionId}:${GLW_TERMINAL_CALLBACK_TYPE}:${semanticPayload.status}`,
    terminalScopeKey: `glw-terminal-v2:${normalizedOperationKey}:${semanticPayload.jobId}:${semanticPayload.executionId}:${GLW_TERMINAL_CALLBACK_TYPE}`,
  };
  const payloadSha256 = hashCanonicalGlwCallbackPayload(identityEnvelope).payloadSha256;
  const payload = { ...identityEnvelope, payloadSha256 };

  deriveGlwCallbackIdentity(payload);
  return payload;
}