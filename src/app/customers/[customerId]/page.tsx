import { AppShell } from "@/components/layout/app-shell";
import { CustomerDetailView } from "@/modules/foundation/CustomerDetailView";

type PageProps = {
  params: Promise<{
    customerId: string;
  }>;
};

export default async function CustomerDetailPage({ params }: PageProps) {
  const { customerId } = await params;

  return (
    <AppShell>
      <CustomerDetailView customerId={customerId} />
    </AppShell>
  );
}
