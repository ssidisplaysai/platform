import { createHmac, timingSafeEqual } from "node:crypto";

type WorkerTokenPayload = {
  workerId: string;
  tokenId: string;
  protocolVersion: string;
  issuedAt: number;
  expiresAt: number;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function issueWorkerToken(input: {
  workerId: string;
  tokenId: string;
  protocolVersion?: string;
  ttlMs?: number;
  secret: string;
}): string {
  const now = Date.now();
  const payload: WorkerTokenPayload = {
    workerId: input.workerId,
    tokenId: input.tokenId,
    protocolVersion: input.protocolVersion ?? "gop-worker/v1",
    issuedAt: now,
    expiresAt: now + (input.ttlMs ?? 60 * 60 * 1000),
  };

  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded, input.secret);
  return `${encoded}.${signature}`;
}

export function verifyWorkerToken(token: string, secret: string): WorkerTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encoded, signature] = parts;
  const expected = sign(encoded, secret);

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return null;
  }

  if (!timingSafeEqual(left, right)) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(encoded)) as WorkerTokenPayload;
  if (!payload.workerId || !payload.tokenId || !payload.protocolVersion) {
    return null;
  }

  if (Date.now() > payload.expiresAt) {
    return null;
  }

  return payload;
}
