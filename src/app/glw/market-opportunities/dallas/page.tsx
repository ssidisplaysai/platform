import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getMarketProductMatchBundle } from "@/modules/foundation/local-market-product-match-repository";
import { DALLAS_MARKET_MATCH_BUNDLE_ID } from "@/modules/glw/dallas-market-product-match-service";
import { GlwMarketOpportunityView } from "@/modules/glw/GlwMarketOpportunityView";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = { searchParams: Promise<{ organizationId?: string | string[]; siteId?: string | string[] }> };
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : value?.[0] ?? null;
export default async function DallasMarketOpportunityPage({ searchParams }: Props) { const query = await searchParams; if (first(query.organizationId) !== "ssi" || first(query.siteId) !== "site-ssi-projectorenclosure") notFound(); const bundle = getMarketProductMatchBundle({ organizationId: "ssi", bundleId: DALLAS_MARKET_MATCH_BUNDLE_ID }); if (!bundle) notFound(); return <AppShell><GlwMarketOpportunityView bundle={bundle} /></AppShell>; }