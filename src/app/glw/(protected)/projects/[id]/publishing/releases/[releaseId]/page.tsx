import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { GmpPublishingDetailWorkspace } from "@/components/gmp/gmp-publishing-detail-workspace";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";

type PageProps = { params: Promise<{ id: string; releaseId: string }> };

export default async function ProjectPublishingReleaseDetailPage({ params }: PageProps) {
  const { id, releaseId } = await params;
  if (!id || id.trim().length < 4 || !releaseId || releaseId.trim().length < 4) notFound();

  const session = await getGlwSession();
  const subject = buildGenesisSubjectFromSession(session);
  const resolver = getGenesisAuthorizationResolver();
  const resource = { workspaceId: "glw-led-display-warehouse", moduleId: "gmp.publishing", route: "/glw/projects/[id]/publishing/releases/[releaseId]" };

  const canRetryRelease = resolver.authorize({
    subject,
    workspaceId: "glw-led-display-warehouse",
    moduleId: "gmp.publishing",
    action: createActionReference("gmp:publishing:retry_publication", "route_access"),
    resource,
  }).allowed;

  const canApproveRelease = resolver.authorize({
    subject,
    workspaceId: "glw-led-display-warehouse",
    moduleId: "gmp.publishing",
    action: createActionReference("gmp:publishing:approve_release", "route_access"),
    resource,
  }).allowed;

  return (
    <GmpPublishingDetailWorkspace
      mode="release"
      projectId={id}
      releaseId={releaseId}
      permissions={{
        canRetryRelease,
        canApproveRelease,
      }}
    />
  );
}
