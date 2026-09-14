import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { FreshSiteOnboardingFlow } from "@/modules/foundation/FreshSiteOnboardingFlow";
import { getSiteById } from "@/modules/foundation/site-repository";

type PageProps = {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ focus?: string }>;
};

export default async function SiteOnboardingPage({ params, searchParams }: PageProps) {
  const { siteId } = await params;
  const { focus } = await searchParams;
  const site = getSiteById(siteId);

  return (
    <AppShell resourceSite={site ? createSiteContext(site) : null}>
      {site ? (
        <FreshSiteOnboardingFlow initialSite={site} mode="configure" focusWordPress={focus === "wordpress"} />
      ) : (
        <div className="border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          Site {siteId} was not found.
        </div>
      )}
    </AppShell>
  );
}