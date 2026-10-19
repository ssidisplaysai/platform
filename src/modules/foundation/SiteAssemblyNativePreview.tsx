"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SiteAssemblyProposal } from "./site-page-generation";
import { deriveNativePreviewTokens, pageWordCount, sectionParagraphs } from "./site-native-preview";
import type { CreativeDirectionProposal, SiteStrategyProposal } from "./site-intelligence";

type Viewport = "desktop" | "tablet" | "mobile";

function viewportWidth(view: Viewport): string {
  if (view === "mobile") return "max-w-[390px]";
  if (view === "tablet") return "max-w-[820px]";
  return "max-w-[1180px]";
}

export function SiteAssemblyNativePreview({ site, assembly, strategy, creative }: {
  site: { organizationId: string; siteId: string; displayName: string };
  assembly: SiteAssemblyProposal;
  strategy: SiteStrategyProposal | null;
  creative: CreativeDirectionProposal | null;
}) {
  const [slug, setSlug] = useState(assembly.pages[0]?.slug ?? "");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const page = useMemo(() => assembly.pages.find((item) => item.slug === slug) ?? assembly.pages[0], [assembly.pages, slug]);
  const tokens = deriveNativePreviewTokens({ strategy, creative });

  if (!page) return <section className="border border-zinc-800 bg-zinc-950 p-6 text-zinc-300">No page content available for preview.</section>;

  const pageLabel = page.slug ? `/${page.slug}` : "/";
  const issueCount = page.quality.blockers.length;

  return (
    <section className="space-y-5 overflow-x-hidden">
      <header className="border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Genesis Native Preview</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{site.displayName} — Assembly Revision {assembly.revision}</h1>
        <p className="mt-2 text-sm text-zinc-300">Read-only internal rendering from persisted Genesis assembly data. No WordPress IDs, drafts, media uploads, or publishing are required.</p>
        <p className="mt-1 text-xs text-zinc-500">Assembly: {assembly.assemblyId} · Status: {assembly.status} · Policy: {assembly.policyVersion}</p>
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
        <p className="mt-2 text-xs text-zinc-500">Preview provenance: page role {page.pageRole} · revision {page.revision} · canonical {page.canonicalPath}</p>
      </section>

      <section className="mx-auto w-full border border-zinc-800 bg-zinc-950 p-3">
        <div className={`mx-auto w-full ${viewportWidth(viewport)} overflow-hidden rounded-2xl border border-zinc-700`} style={{ backgroundColor: tokens.background, color: tokens.textPrimary, fontFamily: tokens.bodyFamily, borderRadius: tokens.radius }}>
          <div className="border-b px-6 py-4" style={{ borderColor: tokens.accentSoft, backgroundColor: tokens.surface }}>
            <nav className="flex flex-wrap gap-3 text-xs uppercase tracking-wide" style={{ color: tokens.textSecondary }}>
              {assembly.navigation.map((item) => <span key={item.href}>{item.label}</span>)}
            </nav>
          </div>
          <main className="space-y-6 p-6">
            <article>
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: tokens.accent }}>{pageLabel}</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight" style={{ fontFamily: tokens.headingFamily }}>{page.h1}</h2>
              <p className="mt-3 text-sm" style={{ color: tokens.textSecondary }}>{page.metaDescription}</p>
            </article>
            {page.sections.map((section) => (
              <section key={section.sectionId} className="rounded-xl border p-4" style={{ borderColor: tokens.accentSoft, backgroundColor: section.presentation === "HERO" || section.presentation === "CTA" ? tokens.surface : "transparent" }}>
                <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: tokens.accent }}>{section.presentation}</p>
                <h3 className="mt-2 text-xl font-semibold" style={{ fontFamily: tokens.headingFamily }}>{section.heading}</h3>
                <div className="mt-2 space-y-2 text-sm" style={{ color: tokens.textSecondary }}>
                  {sectionParagraphs(section).map((entry, index) => <p key={`${section.sectionId}-${index}`}>{entry}</p>)}
                </div>
              </section>
            ))}
            <section className="rounded-xl border p-4" style={{ borderColor: tokens.accentSoft }}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: tokens.accent }}>Image slots</h3>
              <ul className="mt-2 space-y-2 text-sm" style={{ color: tokens.textSecondary }}>
                {page.imageRequirements.map((image) => (
                  <li key={image.slotId} className="rounded border p-2" style={{ borderColor: tokens.accentSoft }}>
                    <p className="font-semibold" style={{ color: tokens.textPrimary }}>{image.placement}</p>
                    <p>{image.subject}</p>
                    <p className="text-xs">Status: {image.status} · Source: {image.source}</p>
                  </li>
                ))}
              </ul>
            </section>
          </main>
          <footer className="border-t px-6 py-4 text-xs" style={{ borderColor: tokens.accentSoft, color: tokens.textSecondary }}>
            <p>Internal preview only — content is not published and no CMS mutation occurred.</p>
          </footer>
        </div>
      </section>

      <section className="border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
        <h2 className="text-lg font-semibold text-white">Page diagnostics</h2>
        <p className="mt-1">Sections: {page.sections.length} · Approximate words: {pageWordCount(page)} · Internal links: {page.internalLinks.length}</p>
        {issueCount > 0 ? <p className="mt-2 text-amber-300">Quality blockers ({issueCount}): {page.quality.blockers.join(", ")}</p> : <p className="mt-2 text-emerald-300">No quality blockers on this page revision.</p>}
      </section>
    </section>
  );
}
