import { AppShell } from "@/components/layout/app-shell";
import { WorkOrderSummaryView } from "@/modules/foundation/WorkOrderSummaryView";

export default function WorkOrderSummaryPage() {
  return (
    <AppShell>
      <WorkOrderSummaryView />
    </AppShell>
  );
}
