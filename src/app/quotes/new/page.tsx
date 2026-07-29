import { AppShell } from "@/components/layout/app-shell";
import { QuoteCreateView } from "@/modules/foundation/QuoteCreateView";

export default function NewQuotePage() {
  return (
    <AppShell>
      <QuoteCreateView />
    </AppShell>
  );
}
