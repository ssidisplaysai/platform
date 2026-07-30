import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { SessionDescriptor, SessionValidationResult } from "../contracts";
import {
  trackSessionCreated,
  trackSessionExpired,
  trackSessionRenewed,
  trackSessionRevoked,
} from "../telemetry/authentication-metrics";

export type GlwSessionPayload = {
  email: string;
  expiresAt: number;
};

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

export class GlwSessionCodec {
  private readonly revokedTokenHashes = new Set<string>();

  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
  ) {}

  encode(payload: GlwSessionPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encodedPayload}.${sign(this.secret, encodedPayload)}`;
  }

  decode(token: string): GlwSessionPayload | null {
    const [payload, signature] = token.split(".");

    if (!payload || !signature || !safeEquals(signature, sign(this.secret, payload))) {
      return null;
    }

    if (this.revokedTokenHashes.has(hashToken(token))) {
      return null;
    }

    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GlwSessionPayload;
      if (!parsed.email || parsed.expiresAt <= Date.now()) {
        trackSessionExpired();
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  create(email: string): { token: string; payload: GlwSessionPayload; descriptor: SessionDescriptor } {
    const expiresAt = Date.now() + this.ttlSeconds * 1000;
    const payload = {
      email: email.trim().toLowerCase(),
      expiresAt,
    };

    const issuedAtIso = new Date().toISOString();
    const descriptor: SessionDescriptor = {
      sessionId: randomUUID(),
      principalId: payload.email,
      identityId: payload.email,
      authenticationContextId: randomUUID(),
      issuedAt: issuedAtIso,
      expiresAt: new Date(expiresAt).toISOString(),
      active: true,
    };

    trackSessionCreated();

    return {
      token: this.encode(payload),
      payload,
      descriptor,
    };
  }

  validate(token: string): SessionValidationResult {
    const decoded = this.decode(token);
    if (!decoded) {
      return {
        valid: false,
        reasonCode: "INVALID_SESSION",
      };
    }

    return {
      valid: true,
      principalId: decoded.email,
      identityId: decoded.email,
      expiresAt: new Date(decoded.expiresAt).toISOString(),
    };
  }

  renew(token: string): { token: string; payload: GlwSessionPayload; descriptor: SessionDescriptor } | null {
    const decoded = this.decode(token);
    if (!decoded) {
      return null;
    }

    trackSessionRenewed();
    return this.create(decoded.email);
  }

  revoke(token: string): void {
    this.revokedTokenHashes.add(hashToken(token));
    trackSessionRevoked();
  }
}
