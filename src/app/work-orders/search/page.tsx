import { AppShell } from "@/components/layout/app-shell";
import { WorkOrdersRegistryView } from "@/modules/foundation/WorkOrdersRegistryView";

type PageProps = {
  searchParams: Promise<{
    query?: string;
  }>;
};

export default async function WorkOrderSearchPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <WorkOrdersRegistryView query={params.query ?? ""} />
    </AppShell>
  );
}
