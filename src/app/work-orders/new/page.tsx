import { AppShell } from "@/components/layout/app-shell";
import { WorkOrderCreateView } from "@/modules/foundation/WorkOrderCreateView";

export default function NewWorkOrderPage() {
  return (
    <AppShell>
      <WorkOrderCreateView />
    </AppShell>
  );
}
