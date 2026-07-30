import type { GenesisAuthorizationSubject } from "../contracts";
import { getGenesisAuthenticatedIdentityFromSession, type GenesisSessionLike } from "./authentication";
import {
  buildGenesisWorkspaceMemberships,
  createGenesisAuthorizationSubjectFromIdentity,
  getGenesisAuthorizationResolver,
  isAuthorizationSubjectAllowedForRoute,
} from "./authorization";

export { getGenesisAuthorizationResolver, buildGenesisWorkspaceMemberships };

export function buildGenesisSubjectFromSession(session: GenesisSessionLike | null): GenesisAuthorizationSubject {
  return createGenesisAuthorizationSubjectFromIdentity(getGenesisAuthenticatedIdentityFromSession(session));
}

export function isSubjectAuthorizedForRoute(input: {
  subject: GenesisAuthorizationSubject;
  workspaceId: string;
  moduleId: string;
  route: string;
}) {
  return isAuthorizationSubjectAllowedForRoute(input);
}
