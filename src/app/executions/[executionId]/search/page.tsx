import { AppShell } from "@/components/layout/app-shell";
import { ExecutionDetailView } from "@/modules/foundation/ExecutionDetailView";

type PageProps = {
  params: Promise<{ executionId: string }>;
};

export default async function ExecutionSearchPage({ params }: PageProps) {
  const { executionId } = await params;

  return (
    <AppShell>
      <ExecutionDetailView executionId={executionId} section="search" />
    </AppShell>
  );
}
