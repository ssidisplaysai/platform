import { AppShell } from "@/components/layout/app-shell";
import { QuotesRegistryView } from "@/modules/foundation/QuotesRegistryView";

type PageProps = {
  searchParams: Promise<{
    query?: string;
    commercialStatus?: string;
  }>;
};

export default async function QuotesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <QuotesRegistryView
        query={params.query ?? ""}
        commercialStatus={params.commercialStatus ?? ""}
      />
    </AppShell>
  );
}
