import { AppShell } from "@/components/layout/app-shell";
import { ProfilesRegistryView } from "@/modules/foundation/ProfilesRegistryView";

type PageProps = {
  searchParams: Promise<{
    query?: string;
    enabledOnly?: string;
  }>;
};

export default async function PromptProfilesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <ProfilesRegistryView
        profileType="prompt"
        query={params.query ?? ""}
        enabledOnly={params.enabledOnly === "true"}
      />
    </AppShell>
  );
}
