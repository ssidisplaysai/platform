import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { GmpPublishingDetailWorkspace } from "@/components/gmp/gmp-publishing-detail-workspace";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";

type PageProps = { params: Promise<{ id: string; publicationId: string }> };

export default async function ProjectPublishingPublicationDetailPage({ params }: PageProps) {
  const { id, publicationId } = await params;
  if (!id || id.trim().length < 4 || !publicationId || publicationId.trim().length < 4) notFound();

  const session = await getGlwSession();
  const subject = buildGenesisSubjectFromSession(session);
  const resolver = getGenesisAuthorizationResolver();
  const resource = { workspaceId: "glw-led-display-warehouse", moduleId: "gmp.publishing", route: "/glw/projects/[id]/publishing/publications/[publicationId]" };

  const canForce = resolver.authorize({
    subject,
    workspaceId: "glw-led-display-warehouse",
    moduleId: "gmp.publishing",
    action: createActionReference("gmp:publishing:force_overwrite", "route_access"),
    resource,
  }).allowed;

  const canRetryPublication = resolver.authorize({
    subject,
    workspaceId: "glw-led-display-warehouse",
    moduleId: "gmp.publishing",
    action: createActionReference("gmp:publishing:retry_publication", "route_access"),
    resource,
  }).allowed;

  const canExecuteRollback = resolver.authorize({
    subject,
    workspaceId: "glw-led-display-warehouse",
    moduleId: "gmp.publishing",
    action: createActionReference("gmp:publishing:execute_rollback", "route_access"),
    resource,
  }).allowed;

  const canReconcilePublication = resolver.authorize({
    subject,
    workspaceId: "glw-led-display-warehouse",
    moduleId: "gmp.publishing",
    action: createActionReference("gmp:publishing:reconcile_publication", "route_access"),
    resource,
  }).allowed;

  return (
    <GmpPublishingDetailWorkspace
      mode="publication"
      projectId={id}
      publicationId={publicationId}
      canForceRepublish={canForce}
      permissions={{
        canRetryPublication,
        canExecuteRollback,
        canReconcilePublication,
      }}
    />
  );
}
