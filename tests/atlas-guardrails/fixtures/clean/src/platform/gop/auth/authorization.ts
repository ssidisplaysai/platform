export function buildGenesisWorkspaceMemberships(actorId: string) {
  return [
    {
      workspaceId: "workspace-1",
      actorId,
      role: "OPERATOR",
    },
  ];
}
