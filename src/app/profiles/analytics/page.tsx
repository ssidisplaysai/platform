import { AppShell } from "@/components/layout/app-shell";
import { ProfilesRegistryView } from "@/modules/foundation/ProfilesRegistryView";

type PageProps = {
  searchParams: Promise<{
    query?: string;
    enabledOnly?: string;
  }>;
};

export default async function AnalyticsProfilesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <ProfilesRegistryView
        profileType="analytics"
        query={params.query ?? ""}
        enabledOnly={params.enabledOnly === "true"}
      />
    </AppShell>
  );
}
