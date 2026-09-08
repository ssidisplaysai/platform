jest.mock("server-only", () => ({}));
jest.mock("../wordpress-credential-resolver", () => ({ resolveWordPressCredentialReference: () => ({ username: "owner", applicationPassword: "application password" }) }));

import { OWNER_MEDIA_AUTHORITY_REGISTRY } from "../owner-supplied-media-ingestion";
import { createOwnerSuppliedMediaWordPressTransport } from "../owner-supplied-media-wordpress-transport";
import type { SiteConfiguration } from "../types";

const site = { siteId: "site-ssi-projectorenclosure", domain: "projectorenclosure.com", integrations: { wordpressApiBaseUrl: "https://projectorenclosure.com/wp-json/wp/v2", wordpressCredentialReference: "credential-ref" } } as SiteConfiguration;
const ldwSite = { ...site, siteId: "site-led-display-warehouse-production", domain: "LEDDisplayWarehouse.com", integrations: { ...site.integrations, wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2" } } as SiteConfiguration;

describe("owner-supplied media WordPress transport", () => {
  afterEach(() => jest.restoreAllMocks());

  test("binds the transport to the exact site", () => {
    expect(createOwnerSuppliedMediaWordPressTransport(site)?.hostname).toBe("projectorenclosure.com");
    expect(createOwnerSuppliedMediaWordPressTransport(ldwSite)?.hostname).toBe("leddisplaywarehouse.com");
    expect(createOwnerSuppliedMediaWordPressTransport({ ...site, siteId: "other" })).toBeNull();
    expect(createOwnerSuppliedMediaWordPressTransport({ ...site, domain: "example.com" })).toBeNull();
  });

  test("uploads with registry-bound filename, MIME, and application-password authentication", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    jest.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      requests.push({ url: String(input), init });
      return Response.json({ id: 15001, status: "inherit", mime_type: "image/png", source_url: "https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-unistrut-mounting-owner-pdf-page-3.png", title: { raw: "" }, alt_text: "", media_details: { width: 730, height: 262 } });
    });
    const authority = OWNER_MEDIA_AUTHORITY_REGISTRY[0], transport = createOwnerSuppliedMediaWordPressTransport(site)!;
    await transport.upload(authority, Buffer.from("png"));
    expect(requests[0]).toMatchObject({ url: "https://projectorenclosure.com/wp-json/wp/v2/media", init: { method: "POST" } });
    expect(new Headers(requests[0].init?.headers).get("Authorization")).toBe(`Basic ${Buffer.from("owner:application password").toString("base64")}`);
    expect(new Headers(requests[0].init?.headers).get("Content-Disposition")).toBe(`attachment; filename="${authority.filename}"`);
    expect(new Headers(requests[0].init?.headers).get("Content-Type")).toBe("image/png");
  });

  test("never deletes a pre-existing attachment", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const transport = createOwnerSuppliedMediaWordPressTransport(site)!;
    expect(await transport.deleteCreated(77)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("fails closed on ambiguous filename identity", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(Response.json([{ id: 3, status: "inherit", mime_type: "image/png", source_url: `https://projectorenclosure.com/wp-content/uploads/${OWNER_MEDIA_AUTHORITY_REGISTRY[0].filename}`, title: { raw: "Wrong" }, alt_text: "Wrong", media_details: {} }]));
    const transport = createOwnerSuppliedMediaWordPressTransport(site)!;
    await expect(transport.findExact(OWNER_MEDIA_AUTHORITY_REGISTRY[0])).rejects.toThrow("OWNER_MEDIA_EXISTING_IDENTITY_AMBIGUOUS");
  });

  test("reuses an exact LDW attachment after WordPress filename sanitization", async () => {
    const authority = OWNER_MEDIA_AUTHORITY_REGISTRY.find((item) => item.authorityId === "ldw-indoor-digital-sphere-owner-photo-v1")!;
    jest.spyOn(global, "fetch").mockResolvedValue(Response.json([{ id: 20076, status: "inherit", mime_type: "image/jpeg", source_url: "https://leddisplaywarehouse.com/wp-content/uploads/2026/09/shared-image-72.jpg", title: { raw: authority.title }, alt_text: authority.altText, media_details: { width: 924, height: 2000 } }]));
    await expect(createOwnerSuppliedMediaWordPressTransport(ldwSite)?.findExact(authority)).resolves.toMatchObject({ id: 20076 });
  });

  test("rejects arbitrary remote byte reads", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const transport = createOwnerSuppliedMediaWordPressTransport(site)!;
    expect(await transport.readBytes("https://example.com/file.png")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});