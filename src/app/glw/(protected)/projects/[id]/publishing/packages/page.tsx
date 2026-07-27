import { notFound } from "next/navigation";
import { GmpPublishingWorkspace } from "@/components/gmp/gmp-publishing-workspace";

type PageProps = { params: Promise<{ id: string }> };

export default async function ProjectPublishingPackagesPage({ params }: PageProps) {
  const { id } = await params;
  if (!id || id.trim().length < 4) notFound();
  return <GmpPublishingWorkspace projectId={id} mode="packages" />;
}
