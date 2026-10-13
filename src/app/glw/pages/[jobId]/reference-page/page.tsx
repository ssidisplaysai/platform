import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { GlwDallasReferencePage } from "@/modules/glw/GlwDallasReferencePage";
import { getDallasPublicationState } from "@/modules/glw/dallas-reference-page-publication-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = { params: Promise<{ jobId: string }>; searchParams: Promise<{ organizationId?: string | string[]; siteId?: string | string[] }> };
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : value?.[0] ?? null;
export default async function DallasReferencePage({ params, searchParams }: Props) { const [{ jobId }, query] = await Promise.all([params, searchParams]); if (jobId !== "2ca74016-252b-4587-bf3c-ec9b7eb839c9" || first(query.organizationId) !== "ssi" || first(query.siteId) !== "site-ssi-projectorenclosure") notFound(); const state = getDallasPublicationState(); const reference=state.referenceCertifications.at(-1);if(!reference||state.referenceRevocations.some((item)=>item.certificationId===reference.certificationId))notFound(); return <AppShell><GlwDallasReferencePage state={state} /></AppShell>; }