import { AppShell } from "@/components/layout/app-shell";
import { RoutingDetailView } from "@/modules/foundation/RoutingDetailView";

type PageProps = { params: Promise<{ routingId: string }> };

export default async function RoutingDetailPage({ params }: PageProps) {
  const { routingId } = await params;

  return (
    <AppShell>
      <RoutingDetailView routingId={routingId} section="overview" />
    </AppShell>
  );
}