import {
  issueWordPressAttributionToken,
  verifyWordPressAttributionToken,
} from "../wordpress-attribution-token";
import {
  captureWordPressAttribution,
  preserveAttributionAcrossCheckout,
  wordpressSessionToWooOrderMeta,
} from "../wordpress-woocommerce-attribution";

const secret = "wordpress-integration-secret";
const payload = {
  organizationId: "stoner",
  touchId: "touch-jessica-001",
  trackingIdentityId: "tracking-jessica",
  canonicalPartnerId: "jessica",
  campaignId: "GYM-LAUNCH-01",
  issuedAt: "2026-10-06T12:00:00Z",
  expiresAt: "2026-11-05T12:00:00Z",
};

describe("WordPress WooCommerce attribution bridge", () => {
  test("signed Genesis token verifies and becomes protected Woo order metadata", () => {
    const token = issueWordPressAttributionToken(payload, secret);
    const session = captureWordPressAttribution({
      token,
      secret,
      now: "2026-10-07T12:00:00Z",
      organizationId: "stoner",
    });
    expect(wordpressSessionToWooOrderMeta(session)).toEqual({
      _genesis_touch_id: "touch-jessica-001",
      _genesis_tracking_identity_id: "tracking-jessica",
      _genesis_partner_id: "jessica",
      _genesis_campaign_id: "GYM-LAUNCH-01",
    });
  });

  test("tampered token cannot change partner attribution", () => {
    const token = issueWordPressAttributionToken(payload, secret);
    const [body, signature] = token.split(".");
    const changed = Buffer.from(JSON.stringify({ ...payload, canonicalPartnerId: "attacker" }))
      .toString("base64url");
    expect(() => verifyWordPressAttributionToken({
      token: `${changed}.${signature}`,
      secret,
      now: "2026-10-07T12:00:00Z",
      expectedOrganizationId: "stoner",
    })).toThrow("INVALID_ATTRIBUTION_TOKEN_SIGNATURE");
    expect(body).not.toBe(changed);
  });

  test("expired attribution cannot enter checkout", () => {
    const token = issueWordPressAttributionToken(payload, secret);
    expect(() => captureWordPressAttribution({
      token,
      secret,
      now: "2026-11-06T12:00:00Z",
      organizationId: "stoner",
    })).toThrow("ATTRIBUTION_TOKEN_EXPIRED");
  });

  test("checkout preserves current attribution when no new qualified token arrives", () => {
    const token = issueWordPressAttributionToken(payload, secret);
    const current = captureWordPressAttribution({
      token,
      secret,
      now: "2026-10-07T12:00:00Z",
      organizationId: "stoner",
    });
    expect(preserveAttributionAcrossCheckout({
      current,
      secret,
      now: "2026-10-07T12:01:00Z",
      organizationId: "stoner",
    })).toEqual(current);
  });
});
