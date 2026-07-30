import { AppShell } from "@/components/layout/app-shell";
import { WorkOrderDetailView } from "@/modules/foundation/WorkOrderDetailView";

type PageProps = {
  params: Promise<{ workOrderId: string }>;
};

export default async function WorkOrderSearchSectionPage({ params }: PageProps) {
  const { workOrderId } = await params;

  return (
    <AppShell>
      <WorkOrderDetailView workOrderId={workOrderId} section="search" />
    </AppShell>
  );
}
