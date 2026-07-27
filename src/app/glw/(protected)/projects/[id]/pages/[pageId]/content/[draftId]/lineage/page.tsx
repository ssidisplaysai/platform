import { notFound } from "next/navigation";
import { GmpContentWorkspace } from "@/components/gmp/gmp-content-workspace";

type PageProps = { params: Promise<{ id: string; pageId: string; draftId: string }> };

export default async function ProjectPageContentLineagePage({ params }: PageProps) {
  const { id, pageId, draftId } = await params;
  if (!id || id.trim().length < 4 || !pageId || pageId.trim().length < 4 || !draftId || draftId.trim().length < 4) notFound();
  return <GmpContentWorkspace projectId={id} pageId={pageId} draftId={draftId} mode="lineage" />;
}