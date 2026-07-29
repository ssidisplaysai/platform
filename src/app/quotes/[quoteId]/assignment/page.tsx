import { AppShell } from "@/components/layout/app-shell";
import { QuoteDetailView } from "@/modules/foundation/QuoteDetailView";

type PageProps = {
  params: Promise<{ quoteId: string }>;
};

export default async function QuoteAssignmentPage({ params }: PageProps) {
  const { quoteId } = await params;

  return (
    <AppShell>
      <QuoteDetailView quoteId={quoteId} section="assignment" />
    </AppShell>
  );
}
