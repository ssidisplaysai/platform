import { AppShell } from "@/components/layout/app-shell";
import { QuoteDetailView } from "@/modules/foundation/QuoteDetailView";

type PageProps = {
  params: Promise<{ quoteId: string }>;
};

export default async function QuoteAuditPage({ params }: PageProps) {
  const { quoteId } = await params;

  return (
    <AppShell>
      <QuoteDetailView quoteId={quoteId} section="audit" />
    </AppShell>
  );
}
