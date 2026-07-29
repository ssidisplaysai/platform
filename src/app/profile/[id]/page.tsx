import { AppShell } from "@/components/layout/app-shell";
import { ProfileDetailView } from "@/modules/foundation/ProfileDetailView";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProfileDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <AppShell>
      <ProfileDetailView profileId={id} />
    </AppShell>
  );
}
