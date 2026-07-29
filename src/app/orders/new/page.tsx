import { AppShell } from "@/components/layout/app-shell";
import { SalesOrderCreateView } from "@/modules/foundation/SalesOrderCreateView";

export default function NewOrderPage() {
  return (
    <AppShell>
      <SalesOrderCreateView />
    </AppShell>
  );
}
