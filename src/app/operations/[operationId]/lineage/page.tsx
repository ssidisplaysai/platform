import { AppShell } from "@/components/layout/app-shell";
import { OperationDetailView } from "@/modules/foundation/OperationDetailView";

type PageProps = {
  params: Promise<{ operationId: string }>;
};

export default async function OperationLineagePage({ params }: PageProps) {
  const { operationId } = await params;

  return (
    <AppShell>
      <OperationDetailView operationId={operationId} section="lineage" />
    </AppShell>
  );
}
