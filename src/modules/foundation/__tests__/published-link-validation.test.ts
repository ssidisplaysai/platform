import { classifyPublishedLinkResult } from "../published-link-validation";

describe("published link validation", () => {
  test("classifies only exact official HeavyM 403 as bot restricted", () => {
    expect(classifyPublishedLinkResult({ requestedUrl: "https://www.heavym.net/", status: 403, resolvedUrl: "https://www.heavym.net/" })).toBe("BOT_RESTRICTED_OFFICIAL_URL");
  });

  test.each([
    "http://www.heavym.net/",
    "https://heavym.net/",
    "https://www.heavym.net/trial/",
    "https://www.heavym.net.evil.example/",
  ])("does not widen the exception to %s", (requestedUrl) => {
    expect(classifyPublishedLinkResult({ requestedUrl, status: 403, resolvedUrl: requestedUrl })).toBe("BROKEN_LINK");
  });

  test("rejects HeavyM when it resolves to an unrelated host", () => {
    expect(classifyPublishedLinkResult({ requestedUrl: "https://www.heavym.net/", status: 403, resolvedUrl: "https://example.com/" })).toBe("BROKEN_LINK");
  });

  test("classifies ordinary success, failure, malformed URLs, and network errors", () => {
    expect(classifyPublishedLinkResult({ requestedUrl: "https://madmapper.com/", status: 200, resolvedUrl: "https://madmapper.com/" })).toBe("VALID");
    expect(classifyPublishedLinkResult({ requestedUrl: "https://example.com/missing", status: 404, resolvedUrl: "https://example.com/missing" })).toBe("BROKEN_LINK");
    expect(classifyPublishedLinkResult({ requestedUrl: "not a url", status: 200, resolvedUrl: "not a url" })).toBe("BROKEN_LINK");
    expect(classifyPublishedLinkResult({ requestedUrl: "https://www.heavym.net/", status: null, resolvedUrl: null, networkError: true })).toBe("NETWORK_ERROR");
  });
});
