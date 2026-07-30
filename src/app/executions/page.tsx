import { AppShell } from "@/components/layout/app-shell";
import { ExecutionRegistryView } from "@/modules/foundation/ExecutionRegistryView";

type PageProps = {
  searchParams: Promise<{
    query?: string;
    status?: string;
    scheduleId?: string;
    productionJobId?: string;
  }>;
};

export default async function ExecutionsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <ExecutionRegistryView
        query={params.query ?? ""}
        status={params.status ?? ""}
        scheduleId={params.scheduleId ?? ""}
        productionJobId={params.productionJobId ?? ""}
      />
    </AppShell>
  );
}
