import type { GenesisAuthenticatedIdentity } from "../contracts";

export type GenesisSessionLike = {
  email: string;
  expiresAt: number;
};

export function getGenesisAuthenticatedIdentityFromSession(
  session: GenesisSessionLike | null,
): GenesisAuthenticatedIdentity | null {
  if (!session) {
    return null;
  }

  const email = session.email.trim().toLowerCase();

  return {
    actorId: email,
    actorName: email,
    email,
    expiresAt: session.expiresAt,
  };
}
