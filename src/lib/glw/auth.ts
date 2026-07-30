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

export async function validateGlwCredentials(email: string, password: string): Promise<boolean> {
  return validateGlwCredentialsThroughIdentity(email, password);
}

export async function createGlwSession(email: string): Promise<void> {
  await createGlwSessionThroughIdentity(email);
}

export async function getGlwSession(): Promise<GlwSession | null> {
  return getGlwSessionThroughIdentity();
}

export async function destroyGlwSession(): Promise<void> {
  await destroyGlwSessionThroughIdentity();
}
