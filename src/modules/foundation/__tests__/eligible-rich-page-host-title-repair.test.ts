jest.mock("server-only", () => ({}));

jest.mock("../wordpress-credential-resolver", () => ({
  resolveWordPressCredentialReference: () => ({ username: "operator", applicationPassword: "secret" }),
}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SiteConfiguration } from "../types";
import { repairEligibleRichPageNativeTitle } from "../eligible-rich-page-host-title-repair";

const rawPostContent = '<main class="saw-page"><h1>Outdoor Digital Sphere in Test State</h1></main>';
const identity = {
  organizationId: "led-display-warehouse",
  siteId: "site-led-display-warehouse-production",
  productId: "prod-outdoor-digital-sphere",
  pageType: "LOCATION_SERVICE" as const,
  wordpressObjectId: "30001",
  parentObjectId: "30000",
  slug: "test-state",
  title: "Outdoor Digital Sphere in Test State",
  featuredMediaId: 0,
  storedPostContentSha: "6fb08825229c46767d55766d4a0437d7499ef9dc6fc2d77893de133111a3d5a1",
};
const site = {
  organizationId: identity.organizationId,
  siteId: identity.siteId,
  domain: "leddisplaywarehouse.com",
  integrations: { wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2", wordpressCredentialReference: "credential" },
} as SiteConfiguration;

function page(hideTitle?: string, status = "publish") {
  return { id: 30001, status, parent: 30000, slug: "test-state", title: { raw: identity.title }, content: { raw: rawPostContent }, featured_media: 0, meta: { _elementor_page_settings: hideTitle ? { hide_title: hideTitle } : {} } };
}

describe("eligible rich-page host title repair", () => {
  test("writes only bounded title meta and preserves exact published identity", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const bodies = [page(), page("yes")];
    const fetcher = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return { ok: true, status: 200, json: async () => init?.method === "POST" ? page("yes") : bodies.shift() } as Response;
    });

    const result = await repairEligibleRichPageNativeTitle({ site, identity, fetcher });

    expect(result).toMatchObject({ statusBefore: "publish", statusAfter: "publish", parentObjectId: "30000", slug: "test-state", nativeTitleSuppressedAfter: true, hostPresentationRepairPerformed: true, postContentMutationPerformed: false, publicationTransactionPerformed: false, rollbackPerformed: false });
    expect(result.postContentShaAfter).toBe(identity.storedPostContentSha);
    const write = calls.find((call) => call.init.method === "POST");
    expect(JSON.parse(String(write?.init.body))).toEqual({ meta: { _elementor_page_settings: { hide_title: "yes" } } });
  });

  test("contains no target-specific production identity", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/foundation/eligible-rich-page-host-title-repair.ts"), "utf8");
    expect(source).not.toMatch(/Indiana|Alaska|20115|20114/);
  });

  test("accepts an explicitly authorized draft identity without publishing it", async () => {
    const bodies = [page(undefined, "draft"), page("yes", "draft")];
    const fetcher = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => ({ ok: true, status: 200, json: async () => init?.method === "POST" ? page("yes", "draft") : bodies.shift() } as Response));

    const result = await repairEligibleRichPageNativeTitle({ site, identity: { ...identity, expectedStatus: "draft" }, fetcher });

    expect(result).toMatchObject({ statusBefore: "draft", statusAfter: "draft", nativeTitleSuppressedAfter: true, publicationTransactionPerformed: false });
  });
});
