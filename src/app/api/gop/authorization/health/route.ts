import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession } from "@/platform/gop/auth/runtime";
import { getGenesisAuthorizationService } from "@/platform/gop/auth/authorization";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const GLW_MODULE_ID = "glw.core";

export async function GET(): Promise<NextResponse> {
  const session = await getGlwSession();
  if (!session) {
    return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
  }

  const subject = buildGenesisSubjectFromSession(session);
  const service = getGenesisAuthorizationService();

  return NextResponse.json({
    capability: "identity.authorization",
    health: service.healthSnapshot({
      requestId: "authorization-health",
      principalId: subject.actorId,
      principalName: subject.actorName,
      actionId: "metrics:view",
      actionType: "metrics_access",
      workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
      moduleId: GLW_MODULE_ID,
      roles: [subject.role],
      memberships: subject.workspaceMemberships,
      permissionSet: {
        directPermissions: subject.permissions,
        inheritedPermissions: [],
        capabilityPermissions: [],
        workspacePermissions: [],
        resourcePermissions: [],
      },
      capabilities: [],
      resource: {
        resourceType: "SERVICE",
        workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
        moduleId: GLW_MODULE_ID,
        route: "/api/gop/authorization/health",
      },
      contractVersion: "1.0.0",
      requestedAt: new Date().toISOString(),
    }),
  });
}
