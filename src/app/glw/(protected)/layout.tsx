import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GlwShell } from "@/components/glw/glw-shell";
import { getGlwSession } from "@/lib/glw/auth";
import { glwSites } from "@/lib/glw/sites";
import { initializePlatform } from "@/lib/gop/platform-bootstrap-api";
import type { GenesisWorkspaceDescriptor } from "@/platform/gop/contracts";
import { buildGenesisSubjectFromSession, isSubjectAuthorizedForRoute } from "@/platform/gop/auth/runtime";

const GLW_WORKSPACE_ID = "glw-led-display-warehouse";
const GLW_MODULE_ID = "glw.core";

const GLW_WORKSPACE_DESCRIPTORS: GenesisWorkspaceDescriptor[] = [
  {
    workspaceId: GLW_WORKSPACE_ID,
    name: "LED Display Warehouse",
    description: "GLW reference workspace",
    enabled: true,
    enabledModuleIds: [GLW_MODULE_ID],
    defaultModuleId: GLW_MODULE_ID,
    availableSites: glwSites.map((site) => ({
      siteId: site.id,
      name: site.name,
      region: site.region,
    })),
    featureFlags: ["gop.events", "gop.inspector"],
    branding: {
      shortName: "GLW",
      logoText: "GLW",
    },
    environment: "development",
    order: 10,
  },
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

  const subject = buildGenesisSubjectFromSession(session);
  const isAllowed = isSubjectAuthorizedForRoute({
    subject,
    workspaceId: GLW_WORKSPACE_ID,
    moduleId: GLW_MODULE_ID,
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
