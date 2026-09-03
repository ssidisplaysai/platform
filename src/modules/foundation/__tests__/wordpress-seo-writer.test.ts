jest.mock("server-only", () => ({}));

jest.mock("../integration-profile-repository", () => ({
  getIntegrationProfileById: jest.fn(() => ({
    references: {
      yoastPolicyReference: "wordpress-rest:/ssi/v1/yoast-update",
    },
  })),
}));

jest.mock("../wordpress-credential-resolver", () => ({
  resolveWordPressCredentialReference: jest.fn(() => ({
    username: "publisher",
    applicationPassword: "application-password",
  })),
}));

import { createWordPressSeoWriter } from "../wordpress-seo-writer";
import type { SiteConfiguration } from "../types";

const site = {
  canonicalUrl: "https://ssi.example.test",
  integrations: {
    wordpressCredentialReference: "credref-wp-ssi",
  },
  profiles: {
    seoProfileReference: "profile-seo-ssi-default",
  },
} as SiteConfiguration;

const seo = {
  focusKeyphrase: "accent rear projection film plano texas",
  seoTitle: "Accent Rear Projection Film Plano Texas | SSI Displays",
  metaDescription: "Explore Accent Rear Projection Film solutions in Plano from Screen Solutions International.",
};

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe("WordPress profile-driven SEO writer", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("writes only the configured exact-post SEO payload", async () => {
    const stored = {
      post_id: 15289,
      focuskw: seo.focusKeyphrase,
      title: seo.seoTitle,
      metadesc: seo.metaDescription,
    };
    const fetchMock = jest.fn(async () => response({ success: true, verified: true, stored }));
    global.fetch = fetchMock as typeof fetch;

    const writer = createWordPressSeoWriter(site);
    expect(writer).not.toBeNull();
    await expect(writer!.write(15289, seo)).resolves.toEqual({ ok: true, stored });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://ssi.example.test/wp-json/ssi/v1/yoast-update");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      post_id: 15289,
      focuskw: seo.focusKeyphrase,
      title: seo.seoTitle,
      metadesc: seo.metaDescription,
    });
  });

  test("fails closed when retained values differ", async () => {
    global.fetch = jest.fn(async () => response({
      success: true,
      verified: true,
      stored: {
        post_id: 15289,
        focuskw: "different",
        title: seo.seoTitle,
        metadesc: seo.metaDescription,
      },
    })) as typeof fetch;

    await expect(createWordPressSeoWriter(site)!.write(15289, seo)).resolves.toMatchObject({ ok: false });
  });
});