import { AppShell } from "@/components/layout/app-shell";
import { ProductionJobDetailView } from "@/modules/foundation/ProductionJobDetailView";

type PageProps = {
  params: Promise<{ productionJobId: string }>;
};

export default async function ProductionJobRevisionsPage({ params }: PageProps) {
  const { productionJobId } = await params;

  return (
    <AppShell>
      <ProductionJobDetailView productionJobId={productionJobId} section="revisions" />
    </AppShell>
  );
}
