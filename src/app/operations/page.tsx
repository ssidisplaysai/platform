import { AppShell } from "@/components/layout/app-shell";
import { OperationRegistryView } from "@/modules/foundation/OperationRegistryView";

type PageProps = {
  searchParams: Promise<{
    query?: string;
    status?: string;
    operationType?: string;
  }>;
};

export default async function OperationsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <OperationRegistryView
        query={params.query ?? ""}
        status={params.status ?? ""}
        operationType={params.operationType ?? ""}
      />
    </AppShell>
  );
}
