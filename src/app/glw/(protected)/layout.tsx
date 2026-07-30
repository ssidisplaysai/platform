import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GlwShell } from "@/components/glw/glw-shell";
import { getGlwSession } from "@/lib/glw/auth";
import { glwSites } from "@/lib/glw/sites";
import { initializePlatform } from "@/lib/gop/platform-bootstrap-api";
import type { GenesisWorkspaceDescriptor } from "@/platform/gop/contracts";
import { getGenesisAuthenticatedIdentityFromSession } from "@/platform/gop/auth/authentication";
import { createGenesisAuthorizationSubjectFromIdentity } from "@/platform/gop/auth/authorization";
import { isSubjectAuthorizedForRoute } from "@/platform/gop/auth/runtime";
import {
  createPrimaryWorkspaceDescriptor,
  GENESIS_PRIMARY_WORKSPACE_ID,
  GENESIS_PRIMARY_WORKSPACE_MODULE_ID,
  toWorkspaceSites,
} from "@/platform/gop/workspaces/identity";

const GLW_WORKSPACE_DESCRIPTORS: GenesisWorkspaceDescriptor[] = [
  createPrimaryWorkspaceDescriptor({
    availableSites: toWorkspaceSites(glwSites),
  }),
];

export const metadata: Metadata = {
  title: "GLW",
  description: "GLW application console.",
};

export default async function ProtectedGlwLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getGlwSession();

  if (!session) {
    redirect("/glw/login");
  }

  const identity = getGenesisAuthenticatedIdentityFromSession(session);
  const subject = createGenesisAuthorizationSubjectFromIdentity(identity);
  const isAllowed = isSubjectAuthorizedForRoute({
    subject,
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: GENESIS_PRIMARY_WORKSPACE_MODULE_ID,
    route: "/glw",
  });

  if (!isAllowed) {
    redirect("/glw/login");
  }

  const bootstrap = initializePlatform({
    subject,
    workspaceDescriptors: GLW_WORKSPACE_DESCRIPTORS,
  });

  if (!bootstrap.workspace) {
    redirect("/glw/login");
  }

  return (
    <GlwShell navigationItems={bootstrap.navigationItems} workspace={bootstrap.workspace}>
      {children}
    </GlwShell>
  );
}
