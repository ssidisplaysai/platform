import { AppShell } from "@/components/layout/app-shell";
import { ProductionJobCreateView } from "@/modules/foundation/ProductionJobCreateView";

export default function NewProductionJobPage() {
  return (
    <AppShell>
      <ProductionJobCreateView />
    </AppShell>
  );
}
