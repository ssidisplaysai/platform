import "server-only";

import { cookies } from "next/headers";
import { getIdentityConfiguration } from "../config";
import { getGenesisAuthenticationService } from "../services";

export type GlwSession = {
  email: string;
  expiresAt: number;
};

function getCookieConfiguration() {
  const config = getIdentityConfiguration();

  return {
    name: config.glw.sessionCookieName,
    ttlSeconds: config.glw.sessionTtlSeconds,
    secure: config.glw.secureCookies,
  };
}

export async function validateGlwCredentials(email: string, password: string): Promise<boolean> {
  const service = getGenesisAuthenticationService();
  const result = await service.authenticatePassword(email, password);
  return result.authenticated;
}

export async function createGlwSession(email: string): Promise<void> {
  const service = getGenesisAuthenticationService();
  const issued = service.createSessionToken(email);
  const cookieStore = await cookies();
  const cookieConfig = getCookieConfiguration();

  cookieStore.set(cookieConfig.name, issued.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieConfig.secure,
    path: "/",
    maxAge: cookieConfig.ttlSeconds,
  });
}

export async function getGlwSession(): Promise<GlwSession | null> {
  const service = getGenesisAuthenticationService();
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieConfiguration().name)?.value;

  if (!token) {
    return null;
  }

  const session = service.readSessionToken(token);
  if (!session) {
    return null;
  }

  return {
    email: session.email,
    expiresAt: session.expiresAt,
  };
}

export async function renewGlwSession(): Promise<boolean> {
  const service = getGenesisAuthenticationService();
  const cookieStore = await cookies();
  const cookieConfig = getCookieConfiguration();
  const token = cookieStore.get(cookieConfig.name)?.value;

  if (!token) {
    return false;
  }

  const renewed = service.renewSessionToken(token);
  if (!renewed) {
    return false;
  }

  cookieStore.set(cookieConfig.name, renewed.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieConfig.secure,
    path: "/",
    maxAge: cookieConfig.ttlSeconds,
  });

  return true;
}

export async function destroyGlwSession(): Promise<void> {
  const service = getGenesisAuthenticationService();
  const cookieStore = await cookies();
  const cookieConfig = getCookieConfiguration();
  const token = cookieStore.get(cookieConfig.name)?.value;

  if (token) {
    const parsed = service.readSessionToken(token);
    service.revokeSessionToken(token, parsed?.email);
    await service.recordLogout(parsed?.email);
  }

  cookieStore.delete(cookieConfig.name);
}
