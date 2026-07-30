import type { AuthorizationContext } from "./AuthorizationContext";
import type { ResolvedWorkspaceAccess } from "./WorkspaceResolver";

export class ResourceAuthorizer {
  authorize(context: AuthorizationContext, workspace: ResolvedWorkspaceAccess): {
    allowed: boolean;
    reasonCode?: "DENIED_WORKSPACE" | "DENIED_OWNERSHIP";
    reason?: string;
  } {
    if (context.workspaceId && !workspace.member) {
      return {
        allowed: false,
        reasonCode: "DENIED_WORKSPACE",
        reason: "Actor is not a member of the workspace.",
      };
    }

    if (
      context.resource.ownerActorId
      && workspace.viewer
      && !workspace.administrator
      && !workspace.contributor
      && context.resource.ownerActorId !== context.principalId
    ) {
      return {
        allowed: false,
        reasonCode: "DENIED_OWNERSHIP",
        reason: "Viewer role can only access owned resources.",
      };
    }

    return { allowed: true };
  }
}
