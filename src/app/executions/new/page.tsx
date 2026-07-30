import { AppShell } from "@/components/layout/app-shell";
import { ExecutionCreateView } from "@/modules/foundation/ExecutionCreateView";

export default function NewExecutionPage() {
  return (
    <AppShell>
      <ExecutionCreateView />
    </AppShell>
  );
}
