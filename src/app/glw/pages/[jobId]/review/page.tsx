import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { GlwGeneratedPageReviewWorkspace } from "@/modules/glw/GlwGeneratedPageReviewWorkspace";
import { buildGeneratedPageReviewModel } from "@/modules/glw/generated-page-review-read-model";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ jobId: string }>; searchParams: Promise<{ organizationId?: string | string[]; siteId?: string | string[] }> };
function first(value: string | string[] | undefined): string | null { return typeof value === "string" ? value : value?.[0] ?? null; }

export default async function GlwGeneratedPageReviewRoute({ params, searchParams }: Props) {
  const [{ jobId }, query] = await Promise.all([params, searchParams]);
  const model = await buildGeneratedPageReviewModel({ jobId, organizationId: first(query.organizationId), siteId: first(query.siteId) });
  if (!model) notFound();
  return <AppShell><GlwGeneratedPageReviewWorkspace model={model} /></AppShell>;
}