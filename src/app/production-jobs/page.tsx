import { AppShell } from "@/components/layout/app-shell";
import { ProductionJobsRegistryView } from "@/modules/foundation/ProductionJobsRegistryView";

type PageProps = {
  searchParams: Promise<{
    query?: string;
    status?: string;
  }>;
};

export default async function ProductionJobsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <ProductionJobsRegistryView
        query={params.query ?? ""}
        status={params.status ?? ""}
      />
    </AppShell>
  );
}
