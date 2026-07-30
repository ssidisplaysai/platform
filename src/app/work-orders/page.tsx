import { AppShell } from "@/components/layout/app-shell";
import { WorkOrdersRegistryView } from "@/modules/foundation/WorkOrdersRegistryView";

type PageProps = {
  searchParams: Promise<{
    query?: string;
    status?: string;
  }>;
};

export default async function WorkOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <WorkOrdersRegistryView
        query={params.query ?? ""}
        status={params.status ?? ""}
      />
    </AppShell>
  );
}
