import { notFound } from "next/navigation";
import { GmpContentWorkspace } from "@/components/gmp/gmp-content-workspace";

type PageProps = { params: Promise<{ id: string; pageId: string }> };

export default async function ProjectPageContentGeneratePage({ params }: PageProps) {
  const { id, pageId } = await params;
  if (!id || id.trim().length < 4 || !pageId || pageId.trim().length < 4) notFound();
  return <GmpContentWorkspace projectId={id} pageId={pageId} mode="generate" />;
}
