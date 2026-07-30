import "server-only";

import {
  createGlwSession as createGlwSessionThroughIdentity,
  destroyGlwSession as destroyGlwSessionThroughIdentity,
  getGlwSession as getGlwSessionThroughIdentity,
  validateGlwCredentials as validateGlwCredentialsThroughIdentity,
} from "@/platform/identity/adapters/glw-auth-compatibility";

type GlwSession = {
  email: string;
  expiresAt: number;
};

export function validateGlwCredentials(email: string, password: string): Promise<boolean> {
  return validateGlwCredentialsThroughIdentity(email, password);
}

export function createGlwSession(email: string): Promise<void> {
  return createGlwSessionThroughIdentity(email);
}

export function getGlwSession(): Promise<GlwSession | null> {
  return getGlwSessionThroughIdentity();
}

export function destroyGlwSession(): Promise<void> {
  return destroyGlwSessionThroughIdentity();
}
