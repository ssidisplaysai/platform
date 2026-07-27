import { notFound } from "next/navigation";
import { GmpProjectDashboard } from "@/components/gmp/gmp-project-dashboard";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function GlwProjectDetailsPage({ params }: ProjectPageProps) {
  const { id } = await params;

  if (!id || id.trim().length < 4) {
    notFound();
  }

  return <GmpProjectDashboard projectId={id} />;
}
