import { AppShell } from "@/components/layout/app-shell";
import { CustomersRegistryView } from "@/modules/foundation/CustomersRegistryView";

type PageProps = {
  searchParams: Promise<{
    query?: string;
    enabledOnly?: string;
  }>;
};

export default async function CustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <CustomersRegistryView
        query={params.query ?? ""}
        enabledOnly={params.enabledOnly === "true"}
      />
    </AppShell>
  );
}
