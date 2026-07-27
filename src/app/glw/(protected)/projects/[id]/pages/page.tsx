import { notFound } from "next/navigation";
import { GmpPagesWorkspace } from "@/components/gmp/gmp-pages-workspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPagesPage({ params }: PageProps) {
  const { id } = await params;
  if (!id || id.trim().length < 4) {
    notFound();
  }

  return <GmpPagesWorkspace projectId={id} mode="inventory" />;
}
