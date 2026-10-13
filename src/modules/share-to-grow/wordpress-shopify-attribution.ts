import {
  GENESIS_WORDPRESS_SESSION_KEY,
  type WordPressAttributionSession,
} from "./wordpress-woocommerce-attribution";
import { GENESIS_SHOPIFY_ATTRIBUTE_KEYS } from "./adapters/shopify";

export interface ShopifyAttributePair {
  readonly name: string;
  readonly value: string;
}

export interface ShopifyLinePropertyPair {
  readonly name: string;
  readonly value: string;
}

export function wordpressSessionToShopifyCartAttributes(
  session: WordPressAttributionSession | undefined,
): readonly ShopifyAttributePair[] {
  if (!session) return Object.freeze([]);
  const attributes: ShopifyAttributePair[] = [
    { name: GENESIS_SHOPIFY_ATTRIBUTE_KEYS.touchId, value: session.payload.touchId },
    {
      name: GENESIS_SHOPIFY_ATTRIBUTE_KEYS.trackingIdentityId,
      value: session.payload.trackingIdentityId,
    },
    { name: GENESIS_SHOPIFY_ATTRIBUTE_KEYS.canonicalPartnerId, value: session.payload.canonicalPartnerId },
  ];
  if (session.payload.campaignId) {
    attributes.push({ name: GENESIS_SHOPIFY_ATTRIBUTE_KEYS.campaignId, value: session.payload.campaignId });
  }
  return Object.freeze(attributes);
}

export function wordpressSessionToShopifyLineProperties(
  session: WordPressAttributionSession | undefined,
): readonly ShopifyLinePropertyPair[] {
  return wordpressSessionToShopifyCartAttributes(session);
}

export function shopifyAttributeRecord(
  attributes: readonly ShopifyAttributePair[],
): Readonly<Record<string, string>> {
  const record: Record<string, string> = {};
  for (const attribute of attributes) {
    if (!attribute.name || !attribute.value) continue;
    record[attribute.name] = attribute.value;
  }
  return Object.freeze(record);
}

export function handoffCookieName(): string {
  return GENESIS_WORDPRESS_SESSION_KEY;
}
