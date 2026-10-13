import { notFound } from "next/navigation";
import { GlwRichCompositionPreview } from "@/modules/glw/GlwRichCompositionPreview";
import { buildGeneratedPageReviewModel } from "@/modules/glw/generated-page-review-read-model";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ jobId: string }>; searchParams: Promise<{ organizationId?: string | string[]; siteId?: string | string[] }> };
function first(value: string | string[] | undefined): string | null { return typeof value === "string" ? value : value?.[0] ?? null; }

export default async function GlwRichCompositionPreviewRoute({ params, searchParams }: Props) {
  const [{ jobId }, query] = await Promise.all([params, searchParams]);
  const model = await buildGeneratedPageReviewModel({ jobId, organizationId: first(query.organizationId), siteId: first(query.siteId) });
  if (!model) notFound();
  return <main className="min-h-screen bg-[#d9d8d3] p-0 lg:p-8"><div className="mx-auto max-w-[1440px] shadow-2xl"><GlwRichCompositionPreview preview={model.richComposition.preview} /></div></main>;
}