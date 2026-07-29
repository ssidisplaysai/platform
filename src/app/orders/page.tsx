import { AppShell } from "@/components/layout/app-shell";
import { SalesOrdersRegistryView } from "@/modules/foundation/SalesOrdersRegistryView";

type PageProps = {
  searchParams: Promise<{
    query?: string;
    status?: string;
  }>;
};

export default async function OrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <SalesOrdersRegistryView
        query={params.query ?? ""}
        status={params.status ?? ""}
      />
    </AppShell>
  );
}
