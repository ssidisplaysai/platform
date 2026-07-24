import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "glw_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type GlwSession = {
  email: string;
  expiresAt: number;
};

function getRequiredEnvironmentValue(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required to use GLW authentication.`);
  }

  return value;
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(payload: string): string {
  return createHmac("sha256", getRequiredEnvironmentValue("GLW_AUTH_SECRET"))
    .update(payload)
    .digest("base64url");
}

function encodeSession(session: GlwSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token: string): GlwSession | null {
  const [payload, signature] = token.split(".");

  if (!payload || !signature || !safeEquals(signature, sign(payload))) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as GlwSession;

    if (!session.email || session.expiresAt <= Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function validateGlwCredentials(email: string, password: string): boolean {
  return (
    safeEquals(email.trim().toLowerCase(), getRequiredEnvironmentValue("GLW_ADMIN_EMAIL").trim().toLowerCase()) &&
    safeEquals(password, getRequiredEnvironmentValue("GLW_ADMIN_PASSWORD"))
  );
}

export async function createGlwSession(email: string): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, encodeSession({ email, expiresAt }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getGlwSession(): Promise<GlwSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  return token ? decodeSession(token) : null;
}

export async function destroyGlwSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
