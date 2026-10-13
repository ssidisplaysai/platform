import {
  handoffCookieName,
  shopifyAttributeRecord,
  wordpressSessionToShopifyCartAttributes,
  wordpressSessionToShopifyLineProperties,
} from "../wordpress-shopify-attribution";

describe("WordPress -> Shopify attribution handoff", () => {
  const session = {
    token: "token",
    payload: {
      organizationId: "stoner",
      touchId: "touch-1",
      trackingIdentityId: "tracking-1",
      canonicalPartnerId: "daniel-coffeen",
      campaignId: "STONER-GYM",
      issuedAt: "2026-10-13T00:00:00Z",
      expiresAt: "2026-11-12T00:00:00Z",
    },
  } as const;

  test("maps session into stable Shopify attribute names", () => {
    expect(shopifyAttributeRecord(wordpressSessionToShopifyCartAttributes(session))).toEqual({
      genesis_touch_id: "touch-1",
      genesis_tracking_identity_id: "tracking-1",
      genesis_partner_id: "daniel-coffeen",
      genesis_campaign_id: "STONER-GYM",
    });
  });

  test("line properties mirror cart attributes for mixed-cart futures", () => {
    expect(shopifyAttributeRecord(wordpressSessionToShopifyLineProperties(session))).toEqual({
      genesis_touch_id: "touch-1",
      genesis_tracking_identity_id: "tracking-1",
      genesis_partner_id: "daniel-coffeen",
      genesis_campaign_id: "STONER-GYM",
    });
  });

  test("handoff uses the existing canonical session key", () => {
    expect(handoffCookieName()).toBe("genesis_share_to_grow_attribution");
  });
});
