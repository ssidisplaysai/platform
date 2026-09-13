import { notFound } from "next/navigation";
import { getLocalPageThemingBundle } from "@/modules/foundation/local-context-page-theming-repository";
import { DALLAS_LOCALIZED_PREVIEW_V2_BUNDLE_ID } from "@/modules/glw/dallas-localized-preview-v2-service";
import { GlwLocalizedRichCompositionPreview } from "@/modules/glw/GlwLocalizedRichCompositionPreview";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = { params: Promise<{ jobId: string }>; searchParams: Promise<{ organizationId?: string | string[]; siteId?: string | string[] }> };
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : value?.[0] ?? null;

export default async function GlwLocalizedCompositionPreviewV2Route({ params, searchParams }: Props) {
  const [{ jobId }, query] = await Promise.all([params, searchParams]); const organizationId = first(query.organizationId); const siteId = first(query.siteId);
  if (!organizationId || !siteId) notFound(); const bundle = getLocalPageThemingBundle({ organizationId, siteId, jobId, bundleId: DALLAS_LOCALIZED_PREVIEW_V2_BUNDLE_ID }); if (!bundle) notFound();
  return <main className="min-h-screen bg-[#cbc8c0] p-0 xl:p-8"><div className="mx-auto max-w-[1600px] shadow-2xl"><GlwLocalizedRichCompositionPreview bundle={bundle} /></div></main>;
}