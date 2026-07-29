import { AppShell } from "@/components/layout/app-shell";
import { SalesOrderDetailView } from "@/modules/foundation/SalesOrderDetailView";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderAuditPage({ params }: PageProps) {
  const { orderId } = await params;

  return (
    <AppShell>
      <SalesOrderDetailView orderId={orderId} section="audit" />
    </AppShell>
  );
}
