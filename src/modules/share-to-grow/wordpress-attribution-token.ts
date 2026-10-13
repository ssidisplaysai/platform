import { createHmac, timingSafeEqual } from "node:crypto";

export interface WordPressAttributionTokenPayload {
  readonly organizationId: string;
  readonly touchId: string;
  readonly trackingIdentityId: string;
  readonly canonicalPartnerId: string;
  readonly campaignId?: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}

function validate(payload: WordPressAttributionTokenPayload): void {
  if (!payload.organizationId || !payload.touchId || !payload.trackingIdentityId || !payload.canonicalPartnerId) {
    throw new Error("INVALID_WORDPRESS_ATTRIBUTION_TOKEN");
  }
  const issued = Date.parse(payload.issuedAt);
  const expires = Date.parse(payload.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued) {
    throw new Error("INVALID_WORDPRESS_ATTRIBUTION_TOKEN_TIME");
  }
}

export function issueWordPressAttributionToken(
  payload: WordPressAttributionTokenPayload,
  secret: string,
): string {
  if (!secret) throw new Error("ATTRIBUTION_TOKEN_SECRET_REQUIRED");
  validate(payload);
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyWordPressAttributionToken(input: {
  readonly token: string;
  readonly secret: string;
  readonly now: string;
  readonly expectedOrganizationId: string;
}): WordPressAttributionTokenPayload {
  if (!input.secret) throw new Error("ATTRIBUTION_TOKEN_SECRET_REQUIRED");
  const parts = input.token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("INVALID_ATTRIBUTION_TOKEN_FORMAT");
  const [encoded, suppliedSignature] = parts;
  const expectedSignature = sign(encoded, input.secret);
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("INVALID_ATTRIBUTION_TOKEN_SIGNATURE");
  }

  let payload: WordPressAttributionTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as WordPressAttributionTokenPayload;
  } catch {
    throw new Error("INVALID_ATTRIBUTION_TOKEN_PAYLOAD");
  }
  validate(payload);
  const now = Date.parse(input.now);
  if (!Number.isFinite(now)) throw new Error("INVALID_ATTRIBUTION_TOKEN_NOW");
  if (now < Date.parse(payload.issuedAt) || now > Date.parse(payload.expiresAt)) {
    throw new Error("ATTRIBUTION_TOKEN_EXPIRED");
  }
  if (payload.organizationId !== input.expectedOrganizationId) {
    throw new Error("ATTRIBUTION_TOKEN_ORGANIZATION_MISMATCH");
  }
  return Object.freeze({ ...payload });
}
