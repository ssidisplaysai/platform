import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { GmpPublishingDetailWorkspace } from "@/components/gmp/gmp-publishing-detail-workspace";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";

type PageProps = { params: Promise<{ id: string; packageId: string }> };

export default async function ProjectPublishingPackageDetailPage({ params }: PageProps) {
  const { id, packageId } = await params;
  if (!id || id.trim().length < 4 || !packageId || packageId.trim().length < 4) notFound();

  const session = await getGlwSession();
  const subject = buildGenesisSubjectFromSession(session);
  const resolver = getGenesisAuthorizationResolver();
  const canApprovePackage = resolver.authorize({
    subject,
    workspaceId: "glw-led-display-warehouse",
    moduleId: "gmp.publishing",
    action: createActionReference("gmp:publishing:approve_package", "route_access"),
    resource: { workspaceId: "glw-led-display-warehouse", moduleId: "gmp.publishing", route: "/glw/projects/[id]/publishing/packages/[packageId]" },
  }).allowed;

  return (
    <GmpPublishingDetailWorkspace
      mode="package"
      projectId={id}
      packageId={packageId}
      permissions={{ canApprovePackage }}
    />
  );
}
