import { notFound } from "next/navigation";
import { getLocalPageThemingBundle } from "@/modules/foundation/local-context-page-theming-repository";
import { GlwLocalizedRichCompositionPreview } from "@/modules/glw/GlwLocalizedRichCompositionPreview";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = { params: Promise<{ jobId: string }>; searchParams: Promise<{ organizationId?: string | string[]; siteId?: string | string[] }> };
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : value?.[0] ?? null;

export default async function GlwLocalizedCompositionPreviewV2Route({ params, searchParams }: Props) {
  const [{ jobId }, query] = await Promise.all([params, searchParams]); const organizationId = first(query.organizationId); const siteId = first(query.siteId);
  if (!organizationId || !siteId) notFound(); const bundle = getLocalPageThemingBundle({ organizationId, siteId, jobId }); if (!bundle) notFound();
  const job = await glwPageExecutionRepository.getById(jobId); const sourceHtml = job?.generatedDraft?.contentHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<(?:iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed|form)>/gi, "").replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, "").replace(/javascript:/gi, "").replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, "").replace(/<img\b[^>]*>/gi, "") ?? null;
  return <main className="min-h-screen bg-[#cbc8c0] p-0 xl:p-8"><div className="mx-auto max-w-[1600px] shadow-2xl"><GlwLocalizedRichCompositionPreview bundle={bundle} sourceHtml={sourceHtml} /></div></main>;
}