import { notFound } from "next/navigation";
import { getGlwSession } from "@/lib/glw/auth";
import { GmpPublishingDetailWorkspace } from "@/components/gmp/gmp-publishing-detail-workspace";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";

type PageProps = { params: Promise<{ id: string; destinationId: string }> };

export default async function ProjectPublishingDestinationDetailPage({ params }: PageProps) {
  const { id, destinationId } = await params;
  if (!id || id.trim().length < 4 || !destinationId || destinationId.trim().length < 4) notFound();

  const session = await getGlwSession();
  const subject = buildGenesisSubjectFromSession(session);
  const resolver = getGenesisAuthorizationResolver();
  const resource = { workspaceId: "glw-led-display-warehouse", moduleId: "gmp.publishing", route: "/glw/projects/[id]/publishing/destinations/[destinationId]" };

  const canForce = resolver.authorize({
    subject,
    workspaceId: "glw-led-display-warehouse",
    moduleId: "gmp.publishing",
    action: createActionReference("gmp:publishing:force_overwrite", "route_access"),
    resource,
  }).allowed;

  const canManageDestinations = resolver.authorize({
    subject,
    workspaceId: "glw-led-display-warehouse",
    moduleId: "gmp.publishing",
    action: createActionReference("gmp:publishing:manage_destinations", "route_access"),
    resource,
  }).allowed;

  const canValidateDestinations = resolver.authorize({
    subject,
    workspaceId: "glw-led-display-warehouse",
    moduleId: "gmp.publishing",
    action: createActionReference("gmp:publishing:validate_destination", "route_access"),
    resource,
  }).allowed;

  return (
    <GmpPublishingDetailWorkspace
      mode="destination"
      projectId={id}
      destinationId={destinationId}
      canForceRepublish={canForce}
      permissions={{
        canManageDestinations,
        canValidateDestinations,
      }}
    />
  );
}
