import { AppShell } from "@/components/layout/app-shell";
import { SalesOrderDetailView } from "@/modules/foundation/SalesOrderDetailView";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderSearchPage({ params }: PageProps) {
  const { orderId } = await params;

  return (
    <AppShell>
      <SalesOrderDetailView orderId={orderId} section="search" />
    </AppShell>
  );
}
