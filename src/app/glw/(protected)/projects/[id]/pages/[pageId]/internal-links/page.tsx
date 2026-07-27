import { notFound } from "next/navigation";
import { GmpPagesWorkspace } from "@/components/gmp/gmp-pages-workspace";

type PageProps = { params: Promise<{ id: string; pageId: string }> };

export default async function ProjectPageInternalLinksPage({ params }: PageProps) {
  const { id, pageId } = await params;
  if (!id || id.trim().length < 4 || !pageId || pageId.trim().length < 4) {
    notFound();
  }

  return <GmpPagesWorkspace projectId={id} pageId={pageId} mode="internal-links" />;
}
