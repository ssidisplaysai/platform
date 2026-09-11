import { AppShell } from "@/components/layout/app-shell";
import { SiteProductAuthorityWorkspace } from "@/modules/foundation/SiteProductAuthorityWorkspace";

type PageProps = { searchParams: Promise<{ organizationId?: string; siteId?: string }> };
export default async function NewProductPage({ searchParams }: PageProps) {
  const { organizationId, siteId } = await searchParams;
  return (
    <AppShell>
      {organizationId && siteId ? <SiteProductAuthorityWorkspace organizationId={organizationId} siteId={siteId} /> : <section className="border border-amber-800 bg-amber-950/20 p-6"><h1 className="text-xl font-semibold text-white">Choose a site before establishing Product / Service Authority</h1><p className="mt-2 text-sm text-zinc-300">Open this workflow from an approved Site Intelligence workspace.</p></section>}
    </AppShell>
  );
}
