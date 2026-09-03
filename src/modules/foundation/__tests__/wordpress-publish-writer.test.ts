jest.mock("server-only", () => ({}));

jest.mock("../wordpress-credential-resolver", () => ({
  resolveWordPressCredentialReference: jest.fn(() => ({
    username: "test-user",
    applicationPassword: "test-password",
  })),
}));

import { publishGenesisWordPressDraft } from "../wordpress-publish-writer";
import type { SiteConfiguration } from "../types";

const site = {
  integrations: {
    wordpressApiBaseUrl: "https://example.com/wp-json/wp/v2",
    wordpressCredentialReference: "credref-wp-test",
  },
} as SiteConfiguration;

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("Genesis WordPress publish writer", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("cache-busts both authoritative reads and requires published readback", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(200, {
        id: 19829,
        slug: "alaska",
        parent: 19812,
        status: "draft",
      }))
      .mockResolvedValueOnce(response(200, {
        id: 19829,
        slug: "alaska",
        parent: 19812,
        status: "publish",
        link: "https://example.com/indoor-digital-sphere/alaska/",
      }))
      .mockResolvedValueOnce(response(200, {
        id: 19829,
        slug: "alaska",
        parent: 19812,
        status: "publish",
        link: "https://example.com/indoor-digital-sphere/alaska/",
      }));

    global.fetch = fetchMock as typeof fetch;

    await expect(publishGenesisWordPressDraft({
      site,
      wordpressObjectId: "19829",
    })).resolves.toMatchObject({
      ok: true,
      wordpressObjectId: "19829",
      wordpressStatus: "publish",
      publicationPerformed: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [beforeUrl, beforeInit] = fetchMock.mock.calls[0];
    const [writeUrl, writeInit] = fetchMock.mock.calls[1];
    const [afterUrl, afterInit] = fetchMock.mock.calls[2];

    expect(beforeUrl).not.toBe(afterUrl);
    expect(beforeUrl).toMatch(/[?&]_genesis_read_nonce=[^&]+/);
    expect(afterUrl).toMatch(/[?&]_genesis_read_nonce=[^&]+/);
    expect(beforeInit).toMatchObject({
      method: "GET",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache",
      },
    });
    expect(afterInit).toMatchObject(beforeInit);
    expect(writeUrl).toBe("https://example.com/wp-json/wp/v2/pages/19829");
    expect(writeInit.method).toBe("POST");
    expect(JSON.parse(String(writeInit.body))).toEqual({ status: "publish" });
  });

  test("does not accept a stale draft as successful verification", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(200, {
        id: 19829,
        slug: "alaska",
        parent: 19812,
        status: "draft",
      }))
      .mockResolvedValueOnce(response(200, {
        id: 19829,
        status: "publish",
      }))
      .mockResolvedValueOnce(response(200, {
        id: 19829,
        slug: "alaska",
        parent: 19812,
        status: "draft",
      })) as typeof fetch;

    await expect(publishGenesisWordPressDraft({
      site,
      wordpressObjectId: "19829",
    })).resolves.toMatchObject({
      ok: false,
      state: "verification_failed",
    });
  });

  test("rejects publication when WordPress changes the page hierarchy", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(200, {
        id: 19829,
        slug: "alaska",
        parent: 19812,
        status: "draft",
      }))
      .mockResolvedValueOnce(response(200, {
        id: 19829,
        slug: "alaska",
        parent: 0,
        status: "publish",
      }))
      .mockResolvedValueOnce(response(200, {
        id: 19829,
        slug: "alaska",
        parent: 0,
        status: "publish",
      })) as typeof fetch;

    await expect(publishGenesisWordPressDraft({
      site,
      wordpressObjectId: "19829",
    })).resolves.toMatchObject({
      ok: false,
      state: "verification_failed",
    });
  });
});