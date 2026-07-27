import { notFound } from "next/navigation";
import { GmpKnowledgeWorkspace } from "@/components/gmp/gmp-knowledge-workspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function GlwProjectKnowledgeConflictsPage({ params }: PageProps) {
  const { id } = await params;
  if (!id || id.trim().length < 4) {
    notFound();
  }

  return <GmpKnowledgeWorkspace projectId={id} mode="conflicts" />;
}
