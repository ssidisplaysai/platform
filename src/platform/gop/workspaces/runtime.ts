import { createGenesisWorkspaceRegistry } from "./registry";
import type { GenesisAuthorizationSubject, GenesisWorkspaceDescriptor } from "../contracts";

export function getGenesisWorkspaceRegistry(workspaceDescriptors: GenesisWorkspaceDescriptor[] = []) {
  return createGenesisWorkspaceRegistry(workspaceDescriptors);
}

export function resolveAuthorizedWorkspaces(
  subject: GenesisAuthorizationSubject,
  workspaceDescriptors: GenesisWorkspaceDescriptor[] = [],
) {
  return getGenesisWorkspaceRegistry(workspaceDescriptors).resolveForSubject(subject);
}
