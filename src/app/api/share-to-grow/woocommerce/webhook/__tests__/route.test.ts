import { NextRequest } from "next/server";
import { POST } from "../route";

describe("share-to-grow woocommerce webhook route", () => {
  const originalSecret = process.env.GENESIS_WOOCOMMERCE_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.GENESIS_WOOCOMMERCE_WEBHOOK_SECRET;
    else process.env.GENESIS_WOOCOMMERCE_WEBHOOK_SECRET = originalSecret;
  });

  test("returns 503 when webhook secret is not configured", async () => {
    delete process.env.GENESIS_WOOCOMMERCE_WEBHOOK_SECRET;

    const request = new NextRequest("http://localhost:3000/api/share-to-grow/woocommerce/webhook", {
      method: "POST",
      body: "{}",
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    await expect(response.json()).resolves.toEqual({
      error: "WOOCOMMERCE_WEBHOOK_SECRET_NOT_CONFIGURED",
    });
    expect(response.status).toBe(503);
  });
});
