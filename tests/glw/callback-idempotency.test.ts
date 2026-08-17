import { describe, expect, it } from "@jest/globals";
import {
  canonicalizeGlwCallbackPayload,
  deriveGlwCallbackIdentity,
  GlwCallbackIdentityError,
  hashCanonicalGlwCallbackPayload,
} from "@/lib/glw/callback-idempotency";
import { classifyExistingGlwCallbackReceipt } from "@/lib/glw/callback-transaction";
import type { GlwPageGenerationCallbackPayload } from "@/lib/glw/jobs";

const legacyPayload: GlwPageGenerationCallbackPayload = {
  jobId: "test_hr004_job",
  executionId: "execution-1",
  status: "FAILED",
  error: { message: "failed", code: "TEST" },
};

describe("HR-004 Slice B callback identity", () => {
  it("derives deterministic namespaced legacy keys", () => {
    const identity = deriveGlwCallbackIdentity(legacyPayload);
    expect(identity.mode).toBe("V1");
    expect(identity.operationKey).toBe("glw-legacy-op-v1:test_hr004_job");
    expect(identity.idempotencyKey).toBe("glw-callback-v1:glw-legacy-op-v1:test_hr004_job:test_hr004_job:execution-1:PAGE_GENERATION_TERMINAL:FAILED");
    expect(identity.terminalScopeKey).toBe("glw-terminal-v1:glw-legacy-op-v1:test_hr004_job:test_hr004_job:execution-1:PAGE_GENERATION_TERMINAL");
  });

  it("produces stable canonical hashes independent of object key order", () => {
    const left = hashCanonicalGlwCallbackPayload({ ...legacyPayload, qaFailureReasons: { b: "two", a: "one" } });
    const right = hashCanonicalGlwCallbackPayload({ ...legacyPayload, qaFailureReasons: { a: "one", b: "two" } });
    expect(left.payloadSha256).toBe(right.payloadSha256);
    expect(left.payloadSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("preserves array order in canonical payloads", () => {
    const first = hashCanonicalGlwCallbackPayload({ ...legacyPayload, qaChecks: { brokenLinks: { pass: true, failures: ["a", "b"] } } });
    const second = hashCanonicalGlwCallbackPayload({ ...legacyPayload, qaChecks: { brokenLinks: { pass: true, failures: ["b", "a"] } } });
    expect(first.payloadSha256).not.toBe(second.payloadSha256);
  });

  it("omits absent optional values", () => {
    const canonical = canonicalizeGlwCallbackPayload({ ...legacyPayload, title: undefined });
    expect(canonical).not.toHaveProperty("title");
  });

  it("excludes sender identity and hash fields from payload identity", () => {
    const base = hashCanonicalGlwCallbackPayload(legacyPayload);
    const withIdentity = hashCanonicalGlwCallbackPayload({
      ...legacyPayload,
      callbackVersion: "2",
      operationKey: "op-1",
      idempotencyKey: "ignored",
      terminalScopeKey: "ignored",
      callbackType: "PAGE_GENERATION_TERMINAL",
      payloadSha256: "ignored",
    });
    expect(withIdentity.payloadSha256).toBe(base.payloadSha256);
  });

  it("accepts exact receiver-recomputed v2 identity", () => {
    const operationKey = "operation-1";
    const payload = {
      ...legacyPayload,
      callbackVersion: "2" as const,
      operationKey,
      callbackType: "PAGE_GENERATION_TERMINAL" as const,
      idempotencyKey: `glw-callback-v2:${operationKey}:${legacyPayload.jobId}:${legacyPayload.executionId}:PAGE_GENERATION_TERMINAL:${legacyPayload.status}`,
      terminalScopeKey: `glw-terminal-v2:${operationKey}:${legacyPayload.jobId}:${legacyPayload.executionId}:PAGE_GENERATION_TERMINAL`,
    };
    const payloadSha256 = hashCanonicalGlwCallbackPayload(payload).payloadSha256;
    expect(deriveGlwCallbackIdentity({ ...payload, payloadSha256 })).toMatchObject({ mode: "V2", operationKey, payloadSha256 });
  });

  it("rejects incomplete v2 identity", () => {
    expect(() => deriveGlwCallbackIdentity({ ...legacyPayload, callbackVersion: "2" })).toThrow(GlwCallbackIdentityError);
  });

  it("requires a sender payload hash for an otherwise complete v2 identity", () => {
    expect(() => deriveGlwCallbackIdentity({
      ...legacyPayload,
      callbackVersion: "2",
      operationKey: "operation-1",
      callbackType: "PAGE_GENERATION_TERMINAL",
      idempotencyKey: "glw-callback-v2:operation-1:test_hr004_job:execution-1:PAGE_GENERATION_TERMINAL:FAILED",
      terminalScopeKey: "glw-terminal-v2:operation-1:test_hr004_job:execution-1:PAGE_GENERATION_TERMINAL",
    })).toThrow("incomplete");
  });

  it("rejects mismatched v2 idempotency key", () => {
    const payload = {
      ...legacyPayload,
      callbackVersion: "2" as const,
      operationKey: "operation-1",
      callbackType: "PAGE_GENERATION_TERMINAL" as const,
      idempotencyKey: "wrong",
      terminalScopeKey: "glw-terminal-v2:operation-1:test_hr004_job:execution-1:PAGE_GENERATION_TERMINAL",
    };
    const payloadSha256 = hashCanonicalGlwCallbackPayload(payload).payloadSha256;
    expect(() => deriveGlwCallbackIdentity({ ...payload, payloadSha256 })).toThrow("receiver-derived identity");
  });

  it("rejects mismatched sender payload hash", () => {
    expect(() => deriveGlwCallbackIdentity({
      ...legacyPayload,
      callbackVersion: "2",
      operationKey: "operation-1",
      callbackType: "PAGE_GENERATION_TERMINAL",
      idempotencyKey: "glw-callback-v2:operation-1:test_hr004_job:execution-1:PAGE_GENERATION_TERMINAL:FAILED",
      terminalScopeKey: "glw-terminal-v2:operation-1:test_hr004_job:execution-1:PAGE_GENERATION_TERMINAL",
      payloadSha256: "0".repeat(64),
    })).toThrow("payload hash");
  });

  it("classifies a globally reused idempotency key from another job as a conflict", () => {
    const identity = deriveGlwCallbackIdentity(legacyPayload);
    expect(classifyExistingGlwCallbackReceipt({
      receiptId: "receipt-other-job",
      idempotencyKey: identity.idempotencyKey,
      terminalScopeKey: identity.terminalScopeKey,
      jobId: "test_hr004_other_job",
      externalExecutionId: legacyPayload.executionId,
      terminalStatus: legacyPayload.status,
      payloadSha256: identity.payloadSha256,
      outcome: "APPLIED",
    }, identity)).toMatchObject({ outcome: "IDEMPOTENCY_CONFLICT", receiptId: "receipt-other-job" });
  });
});