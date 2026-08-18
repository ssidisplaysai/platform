import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { sendGlwDeliveryRequest } from "@/lib/glw/callback-delivery-contract";

describe("HR-004 Slice D callback transport", () => {
  let server: Server;
  let baseUrl: string;

  jest.setTimeout(10_000);

  beforeAll(async () => {
    server = createServer((request, response) => {
      const path = request.url ?? "/";
      if (path === "/timeout") return;
      if (path === "/reset") {
        request.socket.destroy();
        return;
      }
      const status = Number(path.slice(1).split("-")[0]);
      const outcome = path.includes("already") ? "ALREADY_APPLIED"
        : path.includes("applied") ? "APPLIED"
          : path.includes("conflict") ? "TERMINAL_CONFLICT"
            : undefined;
      response.statusCode = status;
      response.setHeader("Content-Type", path.includes("malformed") ? "text/plain" : "application/json");
      response.end(path.includes("malformed") ? "not-json" : JSON.stringify(outcome ? { outcome, receiptId: "receipt-1" } : {}));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it.each([
    ["/200-applied", "ACKNOWLEDGED", "APPLIED"],
    ["/200-already", "ACKNOWLEDGED", "ALREADY_APPLIED"],
    ["/204-malformed", "ACKNOWLEDGED", "ACKNOWLEDGED_2XX_UNPARSED"],
    ["/400", "DEAD_LETTER", "VALIDATION_FAILURE"],
    ["/401", "DEAD_LETTER", "AUTH_FAILURE"],
    ["/403", "DEAD_LETTER", "AUTH_FAILURE"],
    ["/404", "DEAD_LETTER", "DESTINATION_OR_IDENTITY_FAILURE"],
    ["/408", "RETRYABLE", "HTTP_408"],
    ["/409-conflict", "DEAD_LETTER", "TERMINAL_CONFLICT"],
    ["/425", "RETRYABLE", "HTTP_425"],
    ["/429", "RETRYABLE", "HTTP_429"],
    ["/500", "RETRYABLE", "HTTP_500"],
    ["/502", "RETRYABLE", "HTTP_502"],
    ["/503", "RETRYABLE", "HTTP_503"],
    ["/504", "RETRYABLE", "HTTP_504"],
    ["/530", "RETRYABLE", "HTTP_530"],
  ] as const)("classifies actual transport %s", async (path, result, resultClass) => {
    const actual = await sendGlwDeliveryRequest({ callbackUrl: `${baseUrl}${path}`, requestBodyUtf8: '{"status":"FAILED"}', bearerSecret: "test-only" });
    expect(actual).toMatchObject({ result, class: resultClass });
  });

  it("times out a hanging server request", async () => {
    expect(await sendGlwDeliveryRequest({ callbackUrl: `${baseUrl}/timeout`, requestBodyUtf8: "{}", bearerSecret: "test-only", timeoutMs: 30 }))
      .toMatchObject({ result: "RETRYABLE", class: "TIMEOUT" });
  });

  it("classifies a connection reset", async () => {
    expect(await sendGlwDeliveryRequest({ callbackUrl: `${baseUrl}/reset`, requestBodyUtf8: "{}", bearerSecret: "test-only" }))
      .toMatchObject({ result: "RETRYABLE", class: expect.stringMatching(/CONNECTION_RESET|NETWORK/) });
  });

  it("classifies connection refused", async () => {
    expect(await sendGlwDeliveryRequest({ callbackUrl: "http://127.0.0.1:65534/callback", requestBodyUtf8: "{}", bearerSecret: "test-only", timeoutMs: 100 }))
      .toMatchObject({ result: "RETRYABLE", class: "CONNECTION_REFUSED" });
  });

  it("sends exact stored payload bytes and keeps secret out of result", async () => {
    const body = '{"exact":"bytes","order":1}';
    let observed = "";
    const fetchImpl: typeof fetch = async (_url, init) => {
      observed = String(init?.body);
      return new Response(JSON.stringify({ outcome: "APPLIED" }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const result = await sendGlwDeliveryRequest({ callbackUrl: "https://example.test/callback", requestBodyUtf8: body, bearerSecret: "sensitive-test-value", fetchImpl });
    expect(observed).toBe(body);
    expect(JSON.stringify(result)).not.toContain("sensitive-test-value");
  });
});