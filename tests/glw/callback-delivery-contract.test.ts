import { describe, expect, it } from "@jest/globals";
import {
  calculateGlwRetryDelayMs,
  classifyGlwDeliveryResult,
  GLW_DELIVERY_LEASE_TTL_MS,
  GLW_DELIVERY_MAX_ATTEMPTS,
  GLW_DELIVERY_REQUEST_TIMEOUT_MS,
  GLW_DELIVERY_WINDOW_MS,
  glwDeliveryStates,
  sanitizeGlwDeliveryDiagnostic,
} from "@/lib/glw/callback-delivery-contract";

describe("HR-004 Slice D delivery contract", () => {
  it("freezes the six-state lifecycle", () => {
    expect(glwDeliveryStates).toEqual(["PENDING", "LEASED", "IN_FLIGHT", "RETRY_SCHEDULED", "ACKNOWLEDGED", "DEAD_LETTER"]);
  });

  it("freezes attempt, window, timeout, and lease limits", () => {
    expect({ attempts: GLW_DELIVERY_MAX_ATTEMPTS, window: GLW_DELIVERY_WINDOW_MS, timeout: GLW_DELIVERY_REQUEST_TIMEOUT_MS, lease: GLW_DELIVERY_LEASE_TTL_MS })
      .toEqual({ attempts: 12, window: 21_600_000, timeout: 15_000, lease: 60_000 });
  });

  it.each([
    [200, "APPLIED", "ACKNOWLEDGED", "APPLIED"],
    [200, "ALREADY_APPLIED", "ACKNOWLEDGED", "ALREADY_APPLIED"],
    [204, null, "ACKNOWLEDGED", "ACKNOWLEDGED_2XX_UNPARSED"],
    [408, null, "RETRYABLE", "HTTP_408"],
    [425, null, "RETRYABLE", "HTTP_425"],
    [429, null, "RETRYABLE", "HTTP_429"],
    [503, "RETRYABLE_FAILURE", "RETRYABLE", "HTTP_503"],
    [530, null, "RETRYABLE", "HTTP_530"],
    [400, null, "DEAD_LETTER", "VALIDATION_FAILURE"],
    [401, null, "DEAD_LETTER", "AUTH_FAILURE"],
    [404, null, "DEAD_LETTER", "DESTINATION_OR_IDENTITY_FAILURE"],
    [409, "TERMINAL_CONFLICT", "DEAD_LETTER", "TERMINAL_CONFLICT"],
  ] as const)("classifies HTTP %s", (httpStatus, receiverOutcome, result, resultClass) => {
    expect(classifyGlwDeliveryResult({ httpStatus, receiverOutcome })).toEqual({ result, class: resultClass });
  });

  it("classifies transport timeout as retryable", () => {
    expect(classifyGlwDeliveryResult({ transportErrorClass: "TIMEOUT" })).toEqual({ result: "RETRYABLE", class: "TIMEOUT" });
  });

  it("calculates capped persisted-jitter delay vectors", () => {
    expect([1, 2, 8, 9, 11, 12].map((attempt) => calculateGlwRetryDelayMs(attempt, 0.2)))
      .toEqual([18_000, 36_000, 2_304_000, 4_320_000, 4_320_000, null]);
  });

  it("redacts authorization and database credentials", () => {
    const diagnostic = sanitizeGlwDeliveryDiagnostic([
      "Bearer", "token-value", "postgres" + "ql://user:pass@host/db",
      JSON.stringify({ ["author" + "ization"]: "secret" }),
    ].join(" "));
    expect(diagnostic).toBe('Bearer [REDACTED] [REDACTED_DATABASE_URL] {"authorization":"[REDACTED]"}');
  });
});