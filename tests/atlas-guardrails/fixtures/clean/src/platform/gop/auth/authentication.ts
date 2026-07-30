export function getGenesisAuthenticatedIdentityFromSession(session: { email: string }) {
  return {
    actorId: session.email,
  };
}
