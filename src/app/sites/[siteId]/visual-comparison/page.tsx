import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getRenderedVisualCertificationById } from "@/modules/foundation/rendered-visual-certification-repository";
import { renderedVisualUtilization, type RenderedVisualCertification } from "@/modules/foundation/rendered-visual-certification";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ siteId: string }>; searchParams: Promise<{ organizationId?: string | string[]; before?: string | string[]; after?: string | string[] }> };
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : value?.[0] ?? null;

function artifactUrl(certification: RenderedVisualCertification, captureId: string): string {
  return `/api/glw/visual-certifications/${encodeURIComponent(certification.certificationId)}/artifacts/${encodeURIComponent(captureId)}?organizationId=${encodeURIComponent(certification.identity.organizationId)}&siteId=${encodeURIComponent(certification.identity.siteId)}`;
}

function EvidenceColumn({ label, certification }: { label: "BEFORE" | "AFTER"; certification: RenderedVisualCertification }) {
  const desktop = certification.captures.find((capture) => capture.viewportClass === "DESKTOP");
  const mobile = certification.captures.find((capture) => capture.viewportClass === "MOBILE");
  return <section className="min-w-0 border border-zinc-800 bg-zinc-950 p-5" aria-label={`${label} visual evidence`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold text-red-400">{label}</p><h2 className="mt-2 text-lg font-bold text-white">{certification.certificationId}</h2><p className="mt-1 break-all text-xs text-zinc-500">{certification.identity.pageRevisionIdentity}</p></div><span className={`text-sm font-bold ${certification.overallState === "PASS" ? "text-emerald-300" : "text-amber-300"}`}>{certification.overallState}</span></div>
    <div className="mt-5 grid gap-5 sm:grid-cols-2">{[desktop, mobile].filter(Boolean).map((capture) => <article key={capture!.captureId} className="min-w-0"><p className="text-xs font-bold text-zinc-300">{capture!.viewportClass}</p><div role="img" aria-label={`${label} ${capture!.viewportClass.toLowerCase()} governed capture`} className="mt-2 aspect-[4/3] w-full border border-zinc-800 bg-zinc-900 bg-contain bg-top bg-no-repeat" style={{ backgroundImage: `url("${artifactUrl(certification, capture!.captureId)}")` }} /><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-zinc-600">Viewport</dt><dd className="text-zinc-300">{capture!.viewportWidth} × {capture!.viewportHeight}</dd></div><div><dt className="text-zinc-600">Content</dt><dd className="text-zinc-300">{capture!.primaryContentBounds ? `${Math.round(capture!.primaryContentBounds.width)}px · ${Math.round((renderedVisualUtilization(capture!) ?? 0) * 100)}%` : "Not evaluated"}</dd></div><div><dt className="text-zinc-600">Overflow</dt><dd className="text-zinc-300">{capture!.horizontalOverflow}px</dd></div><div><dt className="text-zinc-600">Sections</dt><dd className="text-zinc-300">{capture!.sections.length}</dd></div></dl></article>)}</div>
    <div className="mt-5 border-t border-zinc-800 pt-4"><p className="text-xs uppercase text-zinc-500">Findings</p>{certification.findings.map((finding) => <p key={finding.findingCode} className="mt-2 text-sm text-zinc-300"><span className={finding.state === "PASS" ? "text-emerald-300" : finding.state === "WARNING" ? "text-amber-300" : "text-zinc-500"}>{finding.state}</span> · {finding.summary}</p>)}</div>
  </section>;
}

export default async function SiteVisualComparisonPage({ params, searchParams }: Props) {
  const [{ siteId }, query] = await Promise.all([params, searchParams]); const organizationId = first(query.organizationId); const beforeId = first(query.before); const afterId = first(query.after);
  if (!organizationId || !beforeId || !afterId) notFound();
  const before = getRenderedVisualCertificationById({ organizationId, siteId, certificationId: beforeId }); const after = getRenderedVisualCertificationById({ organizationId, siteId, certificationId: afterId });
  if (!before || !after || before.identity.pageId !== after.identity.pageId) notFound();
  return <AppShell><main className="space-y-6"><header><p className="text-xs font-bold uppercase text-red-400">Owner Visual Review</p><h1 className="mt-2 text-3xl font-black text-white">Commercial Stainless composition comparison</h1><p className="mt-2 text-sm text-zinc-400">Immutable evidence only. This comparison does not approve visual review or authorize publication.</p></header><div className="grid gap-6 xl:grid-cols-2"><EvidenceColumn label="BEFORE" certification={before} /><EvidenceColumn label="AFTER" certification={after} /></div><section className="border border-zinc-800 bg-zinc-900/50 p-5"><p className="text-xs uppercase text-zinc-500">Owner Decision</p><p className="mt-2 font-bold text-white">PENDING</p><p className="mt-2 text-sm text-zinc-400">Review desktop and mobile evidence before recording a separate governed decision.</p></section></main></AppShell>;
}