import { describe, expect, it } from "@jest/globals";

import {
  readBearerToken,
  resolveWorkbookRuntimeConfig,
  validateWorkbookCompileApiRequest,
} from "../api";

describe("Workbook runtime API security", () => {
  it("extracts a bearer token", () => {
    expect(
      readBearerToken("Bearer test-token"),
    ).toBe("test-token");
  });

  it("rejects malformed authorization headers", () => {
    expect(readBearerToken(null)).toBeNull();
    expect(readBearerToken("Basic abc")).toBeNull();
    expect(readBearerToken("Bearer")).toBeNull();
  });

  it("resolves server-controlled runtime configuration", () => {
    expect(
      resolveWorkbookRuntimeConfig({
        GENESIS_RUNTIME_API_KEY: "secret",
        GENESIS_ARTIFACT_ROOT: "C:\\Genesis\\artifacts",
        GENESIS_RUNTIME_MAX_REQUEST_BYTES: "2048",
      }),
    ).toEqual({
      apiKey: "secret",
      artifactRoot: "C:\\Genesis\\artifacts",
      maximumRequestBytes: 2048,
    });
  });

  it("rejects missing runtime configuration", () => {
    expect(() =>
      resolveWorkbookRuntimeConfig({}),
    ).toThrow("GENESIS_RUNTIME_API_KEY");

    expect(() =>
      resolveWorkbookRuntimeConfig({
        GENESIS_RUNTIME_API_KEY: "secret",
      }),
    ).toThrow("GENESIS_ARTIFACT_ROOT");
  });

  it("accepts a workbook compile request without artifactRoot", () => {
    const request = validateWorkbookCompileApiRequest({
      runId: "run-001",
      workbook: {
        spreadsheetId: "sheet-123",
        properties: {
          title: "Workbook",
        },
        sheets: [],
      },
    });

    expect(request.runId).toBe("run-001");
    expect(request.workbook).toBeDefined();
    expect("artifactRoot" in request).toBe(false);
  });

  it("rejects a request without workbook metadata", () => {
    expect(() =>
      validateWorkbookCompileApiRequest({
        runId: "run-001",
      }),
    ).toThrow("workbook metadata");
  });
});
