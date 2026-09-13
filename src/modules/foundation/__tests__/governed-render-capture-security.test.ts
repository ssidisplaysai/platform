import {
  GOVERNED_RENDER_CAPTURE_LIMITS,
  governedCaptureFailureCode,
  isDisallowedCaptureAddress,
  parseGeneratedPageCaptureRequest,
  parseSiteHomeCaptureRequest,
  validateCaptureRedirectChain,
  validateGovernedCaptureUrl,
  withGovernedCaptureLock,
} from "../governed-render-capture-security";

describe("governed render capture security", () => {
  it("declares bounded navigation, capture, artifact, redirect, and concurrency limits", () => {
    expect(GOVERNED_RENDER_CAPTURE_LIMITS).toMatchObject({ navigationTimeoutMs: 20_000, captureTimeoutMs: 45_000, maximumArtifactBytes: 12_000_000, maximumCaptureSetBytes: 20_000_000, maximumRedirects: 3, maximumCapturesPerRequest: 2, browserConcurrency: 1 });
  });
  it("accepts only bounded identity requests and rejects client locations", () => {
    expect(parseGeneratedPageCaptureRequest({})).toEqual({ mode: "CURRENT" });
    expect(parseSiteHomeCaptureRequest({ page: "HOME", mode: "RECAPTURE" })).toEqual({ page: "HOME", mode: "RECAPTURE" });
    for (const value of [
      { url: "https://example.com" }, { host: "example.com" }, { page: "https://example.com" },
      { url: "file:///etc/passwd" }, { url: "data:text/html,test" }, { url: "javascript:alert(1)" },
    ]) expect(() => parseGeneratedPageCaptureRequest(value)).toThrow("CAPTURE_REQUEST_INVALID");
  });

  it("redacts unexpected failure text", () => {
    expect(governedCaptureFailureCode(new Error("authorization=secret"))).toBe("CAPTURE_FAILED");
    expect(governedCaptureFailureCode(new Error("CAPTURE_TIMEOUT: page"))).toBe("CAPTURE_TIMEOUT");
  });

  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.2", "169.254.169.254", "::1", "fc00::1", "fe80::1"])("blocks private address %s", (address) => {
    expect(isDisallowedCaptureAddress(address)).toBe(true);
  });

  it("requires an exact approved HTTPS origin and public DNS answers", async () => {
    const lookup = async () => [{ address: "93.184.216.34", family: 4 }];
    await expect(validateGovernedCaptureUrl({ targetUrl: "https://approved.example/page", allowedOrigins: ["https://approved.example"], lookup })).resolves.toMatchObject({ internal: false });
    await expect(validateGovernedCaptureUrl({ targetUrl: "https://alternate.example/page", allowedOrigins: ["https://approved.example"], lookup })).rejects.toThrow("CAPTURE_ORIGIN_NOT_ALLOWED");
    await expect(validateGovernedCaptureUrl({ targetUrl: "http://approved.example/page", allowedOrigins: ["http://approved.example"], lookup })).rejects.toThrow("CAPTURE_HTTPS_REQUIRED");
    await expect(validateGovernedCaptureUrl({ targetUrl: "https://approved.example/page", allowedOrigins: ["https://approved.example"], lookup: async () => [{ address: "169.254.169.254", family: 4 }] })).rejects.toThrow("CAPTURE_PRIVATE_ADDRESS_BLOCKED");
  });

  it("allows only the explicitly configured Genesis loopback origin", async () => {
    await expect(validateGovernedCaptureUrl({ targetUrl: "http://localhost:3003/internal", allowedOrigins: ["http://localhost:3003"], internalGenesisOrigin: "http://localhost:3003" })).resolves.toMatchObject({ internal: true });
    await expect(validateGovernedCaptureUrl({ targetUrl: "http://localhost:9999/internal", allowedOrigins: ["http://localhost:3003"], internalGenesisOrigin: "http://localhost:3003" })).rejects.toThrow("CAPTURE_ORIGIN_NOT_ALLOWED");
  });

  it("blocks redirect escape and excessive redirects", () => {
    expect(() => validateCaptureRedirectChain({ requestedUrl: "https://approved.example/", responseUrls: ["https://approved.example/", "https://evil.example/"], allowedOrigins: ["https://approved.example"] })).toThrow("CAPTURE_REDIRECT_BLOCKED");
    expect(() => validateCaptureRedirectChain({ requestedUrl: "https://approved.example/", responseUrls: Array.from({ length: GOVERNED_RENDER_CAPTURE_LIMITS.maximumRedirects + 2 }, (_, index) => `https://approved.example/${index}`), allowedOrigins: ["https://approved.example"] })).toThrow("CAPTURE_REDIRECT_LIMIT_EXCEEDED");
  });

  it("prevents duplicate and system-wide simultaneous captures", async () => {
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const first = withGovernedCaptureLock("page-a", () => waiting.then(() => "done"));
    await expect(withGovernedCaptureLock("page-a", async () => "duplicate")).rejects.toThrow("CAPTURE_ALREADY_RUNNING");
    await expect(withGovernedCaptureLock("page-b", async () => "parallel")).rejects.toThrow("CAPTURE_CONCURRENCY_LIMIT");
    release();
    await expect(first).resolves.toBe("done");
  });
});