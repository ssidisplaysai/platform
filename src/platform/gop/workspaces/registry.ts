import type { GenesisAuthorizationSubject, GenesisWorkspaceDescriptor } from "../contracts";

export type GenesisWorkspaceRegistry = {
  list: () => GenesisWorkspaceDescriptor[];
  getById: (workspaceId: string) => GenesisWorkspaceDescriptor | null;
  resolveForSubject: (subject: GenesisAuthorizationSubject) => GenesisWorkspaceDescriptor[];
};

export function createGenesisWorkspaceRegistry(initial: GenesisWorkspaceDescriptor[]): GenesisWorkspaceRegistry {
  const workspaces = [...initial];

  const ordered = () => [...workspaces]
    .filter((workspace) => workspace.enabled)
    .sort((left, right) => {
      const leftOrder = left.order ?? 1000;
      const rightOrder = right.order ?? 1000;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.name.localeCompare(right.name);
    });

  return {
    list() {
      return ordered();
    },

    getById(workspaceId: string) {
      return workspaces.find((workspace) => workspace.workspaceId === workspaceId) ?? null;
    },

    resolveForSubject(subject: GenesisAuthorizationSubject) {
      const allowedWorkspaceIds = new Set(
        subject.workspaceMemberships.filter((membership) => membership.active).map((membership) => membership.workspaceId),
      );

      return ordered().filter((workspace) => allowedWorkspaceIds.has(workspace.workspaceId));
    },
  };
}
