import { AppShell } from "@/components/layout/app-shell";
import { ProductionJobDetailView } from "@/modules/foundation/ProductionJobDetailView";

type PageProps = {
  params: Promise<{ productionJobId: string }>;
};

export default async function ProductionJobTimelinePage({ params }: PageProps) {
  const { productionJobId } = await params;

  return (
    <AppShell>
      <ProductionJobDetailView productionJobId={productionJobId} section="timeline" />
    </AppShell>
  );
}
