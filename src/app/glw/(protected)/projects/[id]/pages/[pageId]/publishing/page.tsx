import { notFound } from "next/navigation";
import { GmpPublishingWorkspace } from "@/components/gmp/gmp-publishing-workspace";

type PageProps = { params: Promise<{ id: string; pageId: string }> };

export default async function ProjectPagePublishingPage({ params }: PageProps) {
  const { id, pageId } = await params;
  if (!id || id.trim().length < 4 || !pageId || pageId.trim().length < 4) notFound();
  return <GmpPublishingWorkspace projectId={id} pageId={pageId} mode="page" />;
}
