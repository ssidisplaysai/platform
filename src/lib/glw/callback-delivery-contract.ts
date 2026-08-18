export const glwDeliveryStates = [
  "PENDING",
  "LEASED",
  "IN_FLIGHT",
  "RETRY_SCHEDULED",
  "ACKNOWLEDGED",
  "DEAD_LETTER",
] as const;

export type GlwDeliveryState = (typeof glwDeliveryStates)[number];

export const GLW_DELIVERY_MAX_ATTEMPTS = 12;
export const GLW_DELIVERY_WINDOW_MS = 6 * 60 * 60 * 1000;
export const GLW_DELIVERY_REQUEST_TIMEOUT_MS = 15_000;
export const GLW_DELIVERY_LEASE_TTL_MS = 60_000;

export type GlwDeliveryClassification = {
  result: "ACKNOWLEDGED" | "RETRYABLE" | "DEAD_LETTER";
  class: string;
};

const retryableTransportClasses = new Set([
  "NETWORK",
  "DNS",
  "TLS",
  "TIMEOUT",
  "CONNECTION_RESET",
  "CONNECTION_REFUSED",
  "MALFORMED_HTTP_RESPONSE",
]);

export function classifyGlwDeliveryResult(input: {
  httpStatus?: number;
  receiverOutcome?: string | null;
  transportErrorClass?: string | null;
}): GlwDeliveryClassification {
  if (input.transportErrorClass) {
    return retryableTransportClasses.has(input.transportErrorClass)
      ? { result: "RETRYABLE", class: input.transportErrorClass }
      : { result: "DEAD_LETTER", class: "UNEXPECTED_TRANSPORT_ERROR" };
  }

  const status = input.httpStatus;
  if (status === undefined) {
    return { result: "RETRYABLE", class: "MALFORMED_HTTP_RESPONSE" };
  }
  if (status >= 200 && status <= 299) {
    return {
      result: "ACKNOWLEDGED",
      class: input.receiverOutcome === "APPLIED" || input.receiverOutcome === "ALREADY_APPLIED"
        ? input.receiverOutcome
        : "ACKNOWLEDGED_2XX_UNPARSED",
    };
  }
  if (status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599)) {
    return { result: "RETRYABLE", class: `HTTP_${status}` };
  }
  if (status === 409) {
    return { result: "DEAD_LETTER", class: input.receiverOutcome ?? "HTTP_409_CONFLICT" };
  }
  if (status === 400 || status === 422) {
    return { result: "DEAD_LETTER", class: "VALIDATION_FAILURE" };
  }
  if (status === 401 || status === 403) {
    return { result: "DEAD_LETTER", class: "AUTH_FAILURE" };
  }
  if (status === 404 || status === 410) {
    return { result: "DEAD_LETTER", class: "DESTINATION_OR_IDENTITY_FAILURE" };
  }
  return { result: "DEAD_LETTER", class: "UNEXPECTED_HTTP_STATUS" };
}

export function calculateGlwRetryDelayMs(attemptNumber: number, jitterFraction: number): number | null {
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1 || attemptNumber >= GLW_DELIVERY_MAX_ATTEMPTS) {
    return null;
  }
  if (!Number.isFinite(jitterFraction) || jitterFraction < 0 || jitterFraction > 0.2) {
    throw new Error("Delivery jitter fraction must be between 0 and 0.2.");
  }
  const baseMs = Math.min(15_000 * (2 ** (attemptNumber - 1)), 3_600_000);
  return Math.round(baseMs * (1 + jitterFraction));
}

export function sanitizeGlwDeliveryDiagnostic(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/("(?:authorization|x-n8n-api-key|password|clientSecret)"\s*:\s*")[^"]*(")/gi, "$1[REDACTED]$2");
}

export type GlwDeliveryTransportResult = GlwDeliveryClassification & {
  httpStatus?: number;
  receiverOutcome?: string;
  receiverReceiptId?: string;
  durationMs: number;
};

export async function sendGlwDeliveryRequest(input: {
  callbackUrl: string;
  requestBodyUtf8: string;
  bearerSecret: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<GlwDeliveryTransportResult> {
  const url = new URL(input.callbackUrl);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname))) {
    throw new Error("Callback transport requires HTTPS or a loopback test endpoint.");
  }
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? GLW_DELIVERY_REQUEST_TIMEOUT_MS);
  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: ["Bearer", input.bearerSecret].join(" ") },
      body: input.requestBodyUtf8,
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null) as { outcome?: unknown; receiptId?: unknown } | null;
    const receiverOutcome = typeof body?.outcome === "string" ? body.outcome : undefined;
    const classification = classifyGlwDeliveryResult({ httpStatus: response.status, receiverOutcome });
    return {
      ...classification,
      httpStatus: response.status,
      receiverOutcome,
      receiverReceiptId: typeof body?.receiptId === "string" ? body.receiptId : undefined,
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  } catch (error) {
    const candidate = error as Error & { code?: string; cause?: unknown; errors?: unknown[] };
    const codes = new Set<string>();
    const collectCodes = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      const nested = value as { code?: unknown; cause?: unknown; errors?: unknown[] };
      if (typeof nested.code === "string") codes.add(nested.code);
      collectCodes(nested.cause);
      nested.errors?.forEach(collectCodes);
    };
    collectCodes(candidate);
    const transportErrorClass = candidate.name === "AbortError"
      ? "TIMEOUT"
      : codes.has("ECONNREFUSED")
        ? "CONNECTION_REFUSED"
        : codes.has("ECONNRESET")
          ? "CONNECTION_RESET"
          : "NETWORK";
    return {
      ...classifyGlwDeliveryResult({ transportErrorClass }),
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  } finally {
    clearTimeout(timeout);
  }
}