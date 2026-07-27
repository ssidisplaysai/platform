import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GlwShell } from "@/components/glw/glw-shell";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession } from "@/platform/gop/auth/runtime";
import { getGenesisNavigationItems } from "@/platform/gop/runtime/loader";
import { getGenesisWorkspaceRegistry, resolveAuthorizedWorkspaces } from "@/platform/gop/workspaces/runtime";

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

  const subject = buildGenesisSubjectFromSession(session);
  const authorizedWorkspaces = resolveAuthorizedWorkspaces(subject);

  if (authorizedWorkspaces.length === 0) {
    redirect("/glw/login");
  }

  const workspace = authorizedWorkspaces[0] ?? getGenesisWorkspaceRegistry().list()[0];

  if (!workspace) {
    redirect("/glw/login");
  }

  const navigationItems = getGenesisNavigationItems({
    subject,
    workspaceId: workspace.workspaceId,
  });

  return (
    <GlwShell navigationItems={navigationItems} workspace={workspace}>
      {children}
    </GlwShell>
  );
}
