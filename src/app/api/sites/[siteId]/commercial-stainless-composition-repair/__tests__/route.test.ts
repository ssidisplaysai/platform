import { NextRequest } from "next/server";

jest.mock("@/modules/foundation/commercial-stainless-composition-repair", () => ({ inspectCommercialStainlessCompositionAuthority: jest.fn(), executeCommercialStainlessCompositionRepair: jest.fn() }));
import { executeCommercialStainlessCompositionRepair } from "@/modules/foundation/commercial-stainless-composition-repair";
import { POST } from "../route";

const execute = jest.mocked(executeCommercialStainlessCompositionRepair);
const context = { params: Promise.resolve({ siteId: "site-rj-metal-commercial-stainless-counters" }) };
const body = { operation: "APPLY_COMMERCIAL_STAINLESS_COMPOSITION_REPAIR", expectedPageRevisionId: "revision-5", expectedBeforeCertificationId: "visual-certification-424e2ea8-7efe-4e74-94aa-1d48c9fbbf4e" };
function request(payload: unknown, role = "platform_admin", siteId = "site-rj-metal-commercial-stainless-counters") { return new NextRequest("http://localhost/api/sites/site-rj-metal-commercial-stainless-counters/commercial-stainless-composition-repair", { method: "POST", headers: { "content-type": "application/json", "x-gcp-roles": role, "x-gcp-organization-id": "rj-metal", "x-gcp-site-id": siteId }, body: JSON.stringify(payload) }); }

describe("Commercial Stainless composition repair route", () => {
  beforeEach(() => jest.clearAllMocks());
  it("requires platform_admin and exact site scope", async () => { expect((await POST(request(body, "ops_manager"), context)).status).toBe(403); expect((await POST(request(body, "platform_admin", "other-site"), context)).status).toBe(403); expect(execute).not.toHaveBeenCalled(); });
  it("rejects arbitrary fields and incomplete revision authority", async () => { expect((await POST(request({ ...body, url: "https://example.com" }), context)).status).toBe(400); expect((await POST(request({ operation: body.operation }), context)).status).toBe(400); expect(execute).not.toHaveBeenCalled(); });
  it("executes only the exact bounded repair", async () => { execute.mockResolvedValueOnce({ receipt: { receiptId: "receipt-1" } as never, revisedPage: { pageRevisionId: "revision-6" } as never, wordpress: { objectId: "10", status: "publish", slug: "home", featuredMediaId: "41" }, publicationPerformed: false, campaignMutationPerformed: false }); const response = await POST(request(body), context); expect(response.status).toBe(201); expect(await response.json()).toMatchObject({ publicationPerformed: false, campaignMutationPerformed: false }); expect(execute).toHaveBeenCalledWith({ actor: "platform_admin", expectedPageRevisionId: "revision-5", expectedBeforeCertificationId: body.expectedBeforeCertificationId }); });
});