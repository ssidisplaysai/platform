import { AppShell } from "@/components/layout/app-shell";
import { OperationCreateView } from "@/modules/foundation/OperationCreateView";

export default function NewOperationPage() {
  return (
    <AppShell>
      <OperationCreateView />
    </AppShell>
  );
}
