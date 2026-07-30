import { AppShell } from "@/components/layout/app-shell";
import { RoutingDetailView } from "@/modules/foundation/RoutingDetailView";

type PageProps = { params: Promise<{ routingId: string }> };

export default async function RoutingAuditPage({ params }: PageProps) {
  const { routingId } = await params;

  return (
    <AppShell>
      <RoutingDetailView routingId={routingId} section="audit" />
    </AppShell>
  );
}