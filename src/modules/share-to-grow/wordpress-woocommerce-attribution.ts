import { GENESIS_WOOCOMMERCE_ORDER_META } from "./adapters/woocommerce";
import {
  verifyWordPressAttributionToken,
  type WordPressAttributionTokenPayload,
} from "./wordpress-attribution-token";

export const GENESIS_WORDPRESS_SESSION_KEY = "genesis_share_to_grow_attribution";
export const GENESIS_WORDPRESS_TOKEN_QUERY_KEY = "genesis_attribution";

export interface WordPressAttributionSession {
  readonly token: string;
  readonly payload: WordPressAttributionTokenPayload;
}

export function captureWordPressAttribution(input: {
  readonly token: string;
  readonly secret: string;
  readonly now: string;
  readonly organizationId: string;
}): WordPressAttributionSession {
  const payload = verifyWordPressAttributionToken({
    token: input.token,
    secret: input.secret,
    now: input.now,
    expectedOrganizationId: input.organizationId,
  });
  return Object.freeze({ token: input.token, payload });
}

export function wordpressSessionToWooOrderMeta(
  session: WordPressAttributionSession | undefined,
): Readonly<Record<string, string>> {
  if (!session) return Object.freeze({});
  const meta: Record<string, string> = {
    [GENESIS_WOOCOMMERCE_ORDER_META.touchId]: session.payload.touchId,
    [GENESIS_WOOCOMMERCE_ORDER_META.trackingIdentityId]: session.payload.trackingIdentityId,
    [GENESIS_WOOCOMMERCE_ORDER_META.canonicalPartnerId]: session.payload.canonicalPartnerId,
  };
  if (session.payload.campaignId) {
    meta[GENESIS_WOOCOMMERCE_ORDER_META.campaignId] = session.payload.campaignId;
  }
  return Object.freeze(meta);
}

export function preserveAttributionAcrossCheckout(input: {
  readonly current?: WordPressAttributionSession;
  readonly incomingToken?: string;
  readonly secret: string;
  readonly now: string;
  readonly organizationId: string;
}): WordPressAttributionSession | undefined {
  if (!input.incomingToken) return input.current;
  return captureWordPressAttribution({
    token: input.incomingToken,
    secret: input.secret,
    now: input.now,
    organizationId: input.organizationId,
  });
}
