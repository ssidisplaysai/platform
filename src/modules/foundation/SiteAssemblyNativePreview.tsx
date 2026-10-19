"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SiteAssemblyProposal, SitePageSection } from "./site-page-generation";
import { deriveNativePreviewTokens, pageWordCount, sectionParagraphs } from "./site-native-preview";
import type { CreativeDirectionProposal, SiteStrategyProposal } from "./site-intelligence";

type Viewport = "desktop" | "tablet" | "mobile";
type ApprovedAsset = { inputId: string; kind: string; classification: string; fileName: string; assetId: string };
type PreviewImageCandidate = { candidateId: string; pageId: string; slotId: string; placementHint: string; status: "READY_FOR_OWNER_REVIEW" | "APPROVED" | "REJECTED" | "BLOCKED" };

function viewportWidth(view: Viewport): string {
  if (view === "mobile") return "max-w-[390px]";
  if (view === "tablet") return "max-w-[820px]";
  return "max-w-[1280px]";
}

function resolveBrandAsset(assets: readonly ApprovedAsset[]): ApprovedAsset | null {
  return assets.find((item) => item.kind === "LOGO") ?? assets.find((item) => /logo|brand/i.test(item.fileName)) ?? assets[0] ?? null;
}

function sectionByPresentation(sections: SitePageSection[], presentation: SitePageSection["presentation"]): SitePageSection[] {
  return sections.filter((item) => item.presentation === presentation);
}

function stripInternalCopy(paragraphs: string[]): string[] {
  const blocked = [
    "creative blueprint",
    "lead with",
    "approved authority",
    "conversion direction",
    "generation policy",
    "owner-approved",
    "owner confirmed",
    "internal guardrail",
  ];
  return paragraphs.filter((line) => {
    const lower = line.toLowerCase();
    return !blocked.some((marker) => lower.includes(marker));
  });
}

function dedupeNavigation(nav: SiteAssemblyProposal["navigation"]): SiteAssemblyProposal["navigation"] {
  const used = new Set<string>();
  return nav.filter((item) => {
    const key = `${item.label.trim().toLowerCase()}|${item.href.trim().toLowerCase()}`;
    if (used.has(key)) return false;
    used.add(key);
    return true;
  });
}

function ctaHref(page: SiteAssemblyProposal["pages"][number]): string {
  const contact = page.internalLinks.find((item) => /quote|contact|consult/i.test(item.anchorText));
  return contact?.href ?? "/contact/";
}

function imageSourceFor(input: {
  site: { organizationId: string; siteId: string };
  pageId: string;
  slotIdIncludes: string[];
  candidates: readonly PreviewImageCandidate[];
  fallbackAsset: ApprovedAsset | null;
}): string | null {
  const candidate = input.candidates.find((item) => item.pageId === input.pageId && input.slotIdIncludes.some((token) => item.slotId.toLowerCase().includes(token)));
  if (candidate) {
    return `/api/sites/${encodeURIComponent(input.site.siteId)}/site-build/image-candidates/${encodeURIComponent(candidate.candidateId)}?organizationId=${encodeURIComponent(input.site.organizationId)}&siteId=${encodeURIComponent(input.site.siteId)}`;
  }
  if (!input.fallbackAsset) return null;
  return `/api/sites/${encodeURIComponent(input.site.siteId)}/intelligence/assets/${encodeURIComponent(input.fallbackAsset.assetId)}?organizationId=${encodeURIComponent(input.site.organizationId)}&siteId=${encodeURIComponent(input.site.siteId)}`;
}

export function SiteAssemblyNativePreview({ site, assembly, strategy, creative, approvedAssets, imageCandidates }: {
  site: { organizationId: string; siteId: string; displayName: string };
  assembly: SiteAssemblyProposal;
  strategy: SiteStrategyProposal | null;
  creative: CreativeDirectionProposal | null;
  approvedAssets: ApprovedAsset[];
  imageCandidates: PreviewImageCandidate[];
}) {
  const [slug, setSlug] = useState(assembly.pages[0]?.slug ?? "");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const page = useMemo(() => assembly.pages.find((item) => item.slug === slug) ?? assembly.pages[0], [assembly.pages, slug]);
  const tokens = deriveNativePreviewTokens({ strategy, creative });
  const brandAsset = resolveBrandAsset(approvedAssets);

  if (!page) return <section className="border border-zinc-800 bg-zinc-950 p-6 text-zinc-300">No page content available for preview.</section>;

  const navItems = dedupeNavigation(assembly.navigation);
  const hero = sectionByPresentation(page.sections, "HERO")[0] ?? null;
  const serviceSections = sectionByPresentation(page.sections, "GRID");
  const process = sectionByPresentation(page.sections, "STEPS")[0] ?? null;
  const prose = sectionByPresentation(page.sections, "PROSE");
  const faq = sectionByPresentation(page.sections, "FAQ")[0] ?? null;
  const cta = sectionByPresentation(page.sections, "CTA")[0] ?? null;
  const heroImage = imageSourceFor({ site, pageId: page.pageId, slotIdIncludes: ["hero"], candidates: imageCandidates, fallbackAsset: brandAsset });
  const industryImage = imageSourceFor({ site, pageId: page.pageId, slotIdIncludes: ["industry", "market", "grid"], candidates: imageCandidates, fallbackAsset: approvedAssets[1] ?? brandAsset });
  const issueCount = page.quality.blockers.length;
  const primaryCtaLabel = strategy?.ctaHierarchy[0] ?? "Get Started";
  const secondaryCtaLabel = strategy?.ctaHierarchy.find((item) => /consult/i.test(item)) ?? "Book a Consultation";

  return (
    <section className="space-y-5 overflow-x-hidden">
      <header className="border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Native Preview</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{site.displayName} — Assembly Revision {assembly.revision}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <span className="border border-zinc-700 px-2 py-1 text-zinc-200">{assembly.pages.length} pages</span>
          <span className="border border-zinc-700 px-2 py-1 text-zinc-200">Strategy rev {strategy?.revision ?? "n/a"}</span>
          <span className="border border-zinc-700 px-2 py-1 text-zinc-200">Creative rev {creative?.revision ?? assembly.creativeRevision}</span>
          <Link href={`/sites/${encodeURIComponent(site.siteId)}/build/pages?organizationId=${encodeURIComponent(site.organizationId)}&siteId=${encodeURIComponent(site.siteId)}`} className="border border-zinc-600 px-2 py-1 text-zinc-200 hover:border-zinc-400">Back to Generated Site Review</Link>
        </div>
      </header>

      <section className="border border-zinc-800 bg-zinc-950 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-zinc-400">Page
            <select value={slug} onChange={(event) => setSlug(event.target.value)} className="mt-1 w-full border border-zinc-700 bg-zinc-900 p-2 text-sm text-white">
              {assembly.pages.map((item) => <option key={item.pageId} value={item.slug}>{item.name} ({item.slug ? `/${item.slug}` : "/"})</option>)}
            </select>
          </label>
          <label className="text-xs text-zinc-400">Viewport
            <select value={viewport} onChange={(event) => setViewport(event.target.value as Viewport)} className="mt-1 w-full border border-zinc-700 bg-zinc-900 p-2 text-sm text-white">
              <option value="desktop">Desktop</option>
              <option value="tablet">Tablet</option>
              <option value="mobile">Mobile</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mx-auto w-full border border-zinc-800 bg-zinc-950 p-3">
        <div className={`mx-auto w-full ${viewportWidth(viewport)} overflow-hidden rounded-2xl border border-zinc-700`} style={{ backgroundColor: tokens.background, color: tokens.textPrimary, fontFamily: tokens.bodyFamily, borderRadius: tokens.radius }}>
          <div className="border-b px-6 py-5" style={{ borderColor: tokens.accentSoft, backgroundColor: tokens.surface }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {brandAsset ? <img src={`/api/sites/${encodeURIComponent(site.siteId)}/intelligence/assets/${encodeURIComponent(brandAsset.assetId)}?organizationId=${encodeURIComponent(site.organizationId)}&siteId=${encodeURIComponent(site.siteId)}`} alt={`${site.displayName} brand`} className="h-10 w-auto rounded bg-white/5 p-1" /> : null}
                <div>
                  <p className="text-lg font-semibold" style={{ fontFamily: tokens.headingFamily }}>{site.displayName}</p>
                  <p className="text-xs" style={{ color: tokens.textSecondary }}>{page.slug ? `/${page.slug}` : "/"}</p>
                </div>
              </div>
              <nav className="flex flex-wrap gap-4 text-sm" style={{ color: tokens.textSecondary }}>
                {navItems.map((item) => <a key={`${item.label}-${item.href}`} href={item.href} className="hover:underline">{item.label}</a>)}
              </nav>
            </div>
          </div>

          <main>
            <section className="grid gap-8 px-6 py-10 md:grid-cols-[1.15fr_1fr]" style={{ background: "radial-gradient(130% 120% at 0% 0%, rgba(34,211,238,0.22), transparent 55%), linear-gradient(180deg, rgba(15,35,63,0.95), rgba(6,20,43,1))" }}>
              <div className="space-y-5">
                <p className="text-xs uppercase tracking-[0.25em]" style={{ color: tokens.accent }}>Grow Local Visibility</p>
                <h2 className="text-4xl font-semibold leading-tight md:text-5xl" style={{ fontFamily: tokens.headingFamily }}>{hero?.heading ?? page.h1}</h2>
                {stripInternalCopy(hero ? sectionParagraphs(hero) : [page.metaDescription]).slice(0, 2).map((entry, index) => (
                  <p key={`hero-copy-${index}`} className="max-w-2xl text-base leading-7" style={{ color: tokens.textSecondary }}>{entry}</p>
                ))}
                <div className="flex flex-wrap gap-3">
                  <a href={ctaHref(page)} className="rounded-md px-5 py-3 text-sm font-semibold text-slate-900" style={{ backgroundColor: tokens.accent }}>{primaryCtaLabel}</a>
                  <a href={ctaHref(page)} className="rounded-md border px-5 py-3 text-sm font-semibold" style={{ borderColor: tokens.accent, color: tokens.textPrimary }}>{secondaryCtaLabel}</a>
                </div>
              </div>
              <div className="relative min-h-[280px] overflow-hidden rounded-xl border" style={{ borderColor: tokens.accentSoft, backgroundColor: "rgba(2, 8, 23, 0.65)" }}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.25),transparent_35%),radial-gradient(circle_at_75%_70%,rgba(56,189,248,0.2),transparent_40%)]" />
                {heroImage ? <img src={heroImage} alt={`${page.name} hero visual`} className="absolute inset-0 h-full w-full object-cover opacity-80 mix-blend-screen" /> : null}
                <div className="absolute inset-0">
                  <span className="absolute left-[18%] top-[22%] h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.85)]" />
                  <span className="absolute left-[58%] top-[38%] h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.8)]" />
                  <span className="absolute left-[72%] top-[62%] h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.85)]" />
                </div>
              </div>
            </section>

            {serviceSections.length > 0 ? (
              <section className="px-6 py-10">
                <h3 className="text-2xl font-semibold" style={{ fontFamily: tokens.headingFamily }}>{serviceSections[0].heading}</h3>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {serviceSections.slice(0, 2).flatMap((section) => stripInternalCopy(sectionParagraphs(section))).slice(0, 4).map((entry, index) => (
                    <article key={`service-card-${index}`} className="rounded-xl border p-4" style={{ borderColor: tokens.accentSoft, backgroundColor: tokens.surface }}>
                      <p className="text-sm leading-6" style={{ color: tokens.textSecondary }}>{entry}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {process ? (
              <section className="px-6 pb-10">
                <h3 className="text-2xl font-semibold" style={{ fontFamily: tokens.headingFamily }}>{process.heading}</h3>
                <ol className="mt-5 grid gap-3 md:grid-cols-2">
                  {stripInternalCopy(sectionParagraphs(process)).slice(0, 4).map((entry, index) => (
                    <li key={`process-step-${index}`} className="rounded-xl border p-4" style={{ borderColor: tokens.accentSoft }}>
                      <p className="text-xs uppercase tracking-[0.22em]" style={{ color: tokens.accent }}>Step {index + 1}</p>
                      <p className="mt-2 text-sm leading-6" style={{ color: tokens.textSecondary }}>{entry}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <section className="grid gap-6 px-6 pb-10 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold" style={{ fontFamily: tokens.headingFamily }}>Industries We Support</h3>
                {(prose.length ? prose : sectionByPresentation(page.sections, "GRID")).slice(0, 1).flatMap((item) => stripInternalCopy(sectionParagraphs(item))).slice(0, 3).map((entry, index) => (
                  <p key={`industry-copy-${index}`} className="text-sm leading-7" style={{ color: tokens.textSecondary }}>{entry}</p>
                ))}
              </div>
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: tokens.accentSoft, backgroundColor: tokens.surface }}>
                {industryImage ? <img src={industryImage} alt="Industry coverage visual" className="h-full min-h-[220px] w-full object-cover" /> : <div className="h-full min-h-[220px] bg-[linear-gradient(160deg,rgba(34,211,238,0.2),rgba(15,35,63,0.9))]" />}
              </div>
            </section>

            {cta ? (
              <section className="mx-6 mb-10 rounded-xl border p-6 text-center" style={{ borderColor: tokens.accentSoft, backgroundColor: tokens.surface }}>
                <h3 className="text-3xl font-semibold" style={{ fontFamily: tokens.headingFamily }}>{cta.heading}</h3>
                {stripInternalCopy(sectionParagraphs(cta)).slice(0, 2).map((entry, index) => <p key={`cta-body-${index}`} className="mx-auto mt-3 max-w-3xl text-sm leading-7" style={{ color: tokens.textSecondary }}>{entry}</p>)}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <a href={ctaHref(page)} className="rounded-md px-5 py-3 text-sm font-semibold text-slate-900" style={{ backgroundColor: tokens.accent }}>{primaryCtaLabel}</a>
                  <a href={ctaHref(page)} className="rounded-md border px-5 py-3 text-sm font-semibold" style={{ borderColor: tokens.accent, color: tokens.textPrimary }}>{secondaryCtaLabel}</a>
                </div>
              </section>
            ) : null}

            {faq ? (
              <section className="mx-6 mb-10 rounded-xl border p-5" style={{ borderColor: tokens.accentSoft }}>
                <h3 className="text-xl font-semibold" style={{ fontFamily: tokens.headingFamily }}>{faq.heading}</h3>
                <div className="mt-3 space-y-2">
                  {stripInternalCopy(sectionParagraphs(faq)).slice(0, 2).map((entry, index) => <p key={`faq-${index}`} className="text-sm" style={{ color: tokens.textSecondary }}>{entry}</p>)}
                </div>
              </section>
            ) : null}
          </main>
        </div>
      </section>

      <section className="border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
        <h2 className="text-lg font-semibold text-white">Preview diagnostics</h2>
        <p className="mt-1">Sections: {page.sections.length} · Approximate words: {pageWordCount(page)} · Internal links: {page.internalLinks.length}</p>
        <p className="mt-1">Visual assets: {approvedAssets.length} approved source assets · {imageCandidates.length} generated/review candidates</p>
        {issueCount > 0 ? <p className="mt-2 text-amber-300">Quality blockers ({issueCount}): {page.quality.blockers.join(", ")}</p> : <p className="mt-2 text-emerald-300">No quality blockers on this page revision.</p>}
      </section>
    </section>
  );
}
