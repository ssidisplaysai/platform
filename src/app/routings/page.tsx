import { AppShell } from "@/components/layout/app-shell";
import { RoutingRegistryView } from "@/modules/foundation/RoutingRegistryView";

type PageProps = {
  searchParams: Promise<{
    query?: string;
    status?: string;
    productReference?: string;
    assemblyReference?: string;
  }>;
};

export default async function RoutingsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <RoutingRegistryView
        query={params.query ?? ""}
        status={params.status ?? ""}
        productReference={params.productReference ?? ""}
        assemblyReference={params.assemblyReference ?? ""}
      />
    </AppShell>
  );
}