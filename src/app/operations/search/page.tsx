import { AppShell } from "@/components/layout/app-shell";
import { OperationRegistryView } from "@/modules/foundation/OperationRegistryView";

type PageProps = {
  searchParams: Promise<{
    query?: string;
  }>;
};

export default async function OperationSearchPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <OperationRegistryView query={params.query ?? ""} status="" operationType="" />
    </AppShell>
  );
}
