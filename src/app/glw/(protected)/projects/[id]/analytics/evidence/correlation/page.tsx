import { notFound } from "next/navigation";
import { GmpAnalyticsWorkspace } from "@/components/gmp/gmp-analytics-workspace";
import { resolveAnalyticsPermissions } from "../../access";

type PageProps = { params: Promise<{ id: string }> };

function toWorkspacePermissions(permissions: Awaited<ReturnType<typeof resolveAnalyticsPermissions>>) {
  return {
    canManageSources: permissions.canManageSources,
    canRunCollection: permissions.canRunCollection,
    canValidateSource: permissions.canValidateSource,
    canViewCapabilities: permissions.canViewCapabilities,
    canViewHealth: permissions.canViewHealth,
    canViewCollections: permissions.canViewCollections,
    canViewCollectionDetail: permissions.canViewCollectionDetail,
    canRetryCollection: permissions.canRetryCollection,
    canViewCollectionTimeline: permissions.canViewCollectionTimeline,
    canViewConfiguration: permissions.canViewConfiguration,
    canManageConfiguration: permissions.canManageConfiguration,
    canViewEvidence: permissions.canViewEvidence,
    canViewEvidenceSnapshots: permissions.canViewEvidenceSnapshots,
    canViewCompilerRuns: permissions.canViewCompilerRuns,
    canRunEvidenceCompiler: permissions.canRunEvidenceCompiler,
    canReplayCompilation: permissions.canReplayCompilation,
    canViewMetricCatalog: permissions.canViewMetricCatalog,
  };
}

export default async function ProjectAnalyticsEvidenceCorrelationPage({ params }: PageProps) {
  const { id } = await params;
  if (!id || id.trim().length < 4) notFound();

  const permissions = await resolveAnalyticsPermissions("/glw/projects/[id]/analytics/evidence/correlation");
  return (
    <GmpAnalyticsWorkspace
      projectId={id}
      mode="correlation-review"
      permissions={toWorkspacePermissions(permissions)}
    />
  );
}
