import { AppShell } from "@/components/layout/app-shell";
import { ProductionJobSummaryView } from "@/modules/foundation/ProductionJobSummaryView";

export default function ProductionJobSummaryPage() {
  return (
    <AppShell>
      <ProductionJobSummaryView />
    </AppShell>
  );
}
