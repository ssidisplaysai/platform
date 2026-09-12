import React from "react";
import Link from "next/link";
import type { GeneratedPageReviewModel, ReviewSignal } from "./generated-page-review-read-model";
import { GlwRenderedDraftPreview } from "./GlwRenderedDraftPreview";

const stateTone: Record<ReviewSignal | GeneratedPageReviewModel["reviewState"], string> = {
  PASS: "text-emerald-300", WARNING: "text-amber-300", BLOCKED: "text-red-300", NOT_EVALUATED: "text-zinc-500",
  READY_FOR_OWNER_REVIEW: "text-emerald-300", NEEDS_ATTENTION: "text-amber-300",
};

function State({ value }: { value: ReviewSignal }) { return <span className={`text-xs font-semibold ${stateTone[value]}`}>{value.replaceAll("_", " ")}</span>; }
function TraceItem({ label, value }: { label: string; value: string | number | null }) { return <div><dt className="text-[11px] uppercase tracking-wider text-zinc-600">{label}</dt><dd className="mt-1 break-all text-sm text-zinc-300">{value ?? "Not available"}</dd></div>; }

export function GlwGeneratedPageReviewWorkspace({ model }: { model: GeneratedPageReviewModel }) {
  const imageStyle = (url: string) => ({ backgroundImage: `url("${url.replaceAll('"', '%22')}")` });
  return <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
    <nav className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-wider text-zinc-400" aria-label="Review navigation">
      <Link href={model.actions.listHref} className="hover:text-white">Campaign list</Link>
      <span aria-hidden="true">/</span>
      <Link href={model.actions.campaignHref} className="hover:text-white">Campaign detail</Link>
      <span aria-hidden="true">/</span>
      <span className="text-white">Page review</span>
    </nav>

    <header className="border border-zinc-800 bg-zinc-900/60 p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${stateTone[model.reviewState]}`}>{model.reviewState.replaceAll("_", " ")}</p>
          <h1 className="mt-3 break-words text-3xl font-black text-white">{model.identity.title}</h1>
          <p className="mt-2 text-lg text-zinc-300">{model.identity.target}</p>
          <p className="mt-2 text-sm text-zinc-400">{model.identity.product} · {model.identity.site}{model.identity.domain ? ` · ${model.identity.domain}` : ""}</p>
          <p className="mt-1 text-sm text-zinc-500">{model.identity.campaign}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {model.actions.canonical ? <a href={model.actions.canonical.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-500">{model.actions.canonical.label}</a> : null}
          <Link href={model.actions.campaignHref} className="inline-flex min-h-11 items-center border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-500">Continue Campaign</Link>
        </div>
      </div>
      <dl className="mt-6 grid gap-4 border-t border-zinc-800 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <TraceItem label="WordPress" value={model.wordpress.objectId ? `#${model.wordpress.objectId} · ${(model.wordpress.status ?? "unknown").toUpperCase()}` : null} />
        <TraceItem label="Lifecycle" value={model.identity.lifecycleState.replaceAll("_", " ").toUpperCase()} />
        <TraceItem label="Canonical path" value={model.identity.canonicalPath} />
        <TraceItem label="Policy" value={model.identity.publicationPolicy.replaceAll("_", " ").toUpperCase()} />
      </dl>
    </header>

    <section className="border border-zinc-800 bg-zinc-900/45 p-5" aria-label="Review issues">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Review Summary</p><h2 className="mt-2 text-xl font-bold text-white">Issues and safe continuation</h2></div><p className={`text-sm font-semibold ${stateTone[model.reviewState]}`}>{model.reviewState.replaceAll("_", " ")}</p></div>
      <div className="mt-4 divide-y divide-zinc-800">
        {model.issues.map((issue, index) => <div key={`${issue.category}-${index}`} className="grid gap-2 py-4 md:grid-cols-[8rem_1fr_1fr]"><p className="text-xs font-semibold text-zinc-400">{issue.category} · {issue.severity}</p><div><p className="font-semibold text-white">{issue.what}</p><p className="mt-1 text-sm text-zinc-400">{issue.effect}</p></div><p className="text-sm text-zinc-300">Safe next step: {issue.safeNextStep}</p></div>)}
      </div>
    </section>

    <section className="min-w-0 max-w-full border border-zinc-800 bg-zinc-900/45 p-5" aria-label="Actual WordPress draft preview">
      {model.wordpress.previewHtml ? <><div className="mb-4 flex flex-wrap gap-3 text-xs text-zinc-400"><span>Identity {model.wordpress.verified ? "VERIFIED" : "ATTENTION"}</span><span>Title {model.wordpress.titleMatchesSource ? "MATCH" : "DIFFERS"}</span><span>Content {model.wordpress.contentMatchesSource ? "MATCH" : "DIFFERS"}</span></div><GlwRenderedDraftPreview html={model.wordpress.previewHtml} baseUrl={model.wordpress.sourceUrl} label="Actual WordPress Draft" /></> : <div><p className="text-xs uppercase tracking-[0.22em] text-red-400">Actual WordPress Draft</p><p className="mt-3 text-sm text-amber-300">Authenticated draft content is unavailable: {model.wordpress.readState.replaceAll("_", " ")}.</p></div>}
    </section>

    <section className="border border-zinc-800 bg-zinc-900/45 p-5" aria-label="Rendered visual QA">
      <p className="text-xs uppercase tracking-[0.22em] text-red-400">Rendered Visual QA</p>
      <div className="mt-4 grid gap-px bg-zinc-800 sm:grid-cols-2 lg:grid-cols-5">
        {[['Desktop Layout', model.visualQa.desktopLayout], ['Hero Composition', model.visualQa.heroComposition], ['Section Composition', model.visualQa.sectionComposition], ['Media Placement', model.visualQa.mediaPlacement], ['Mobile Layout', model.visualQa.mobileLayout]].map(([label, state]) => <div key={label} className="bg-zinc-950 p-4"><p className="text-xs text-zinc-400">{label}</p><p className="mt-2"><State value={state as ReviewSignal} /></p></div>)}
      </div>
      <p className="mt-4 text-sm text-zinc-400">{model.visualQa.authority}</p>
      <p className="mt-2 text-xs text-amber-300">Measured preview dimensions are visible above. Hero composition, section rhythm, media placement, and responsive behavior require screenshot-based certification before a PASS or WARNING is authoritative.</p>
    </section>

    <section className="border border-zinc-800 bg-zinc-900/45 p-5" aria-label="Image review">
      <div><p className="text-xs uppercase tracking-[0.22em] text-red-400">Image Review</p><h2 className="mt-2 text-xl font-bold text-white">Product truth and in-use context</h2></div>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-px bg-zinc-800 lg:grid-cols-2">
        <article className="min-w-0 bg-zinc-950 p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Product Authority</p><p className="mt-2 text-xl font-bold text-amber-300">NOT WIRED</p><div className="mt-4 flex aspect-[16/9] items-center justify-center border border-dashed border-zinc-800 bg-zinc-900 text-center text-sm text-zinc-500">No target-level product image assignment</div><p className="mt-4 text-sm text-zinc-300">{model.images.productAuthority.authority}</p><p className="mt-2 break-all text-xs text-zinc-500">{model.images.productAuthority.provenance}</p><p className="mt-3 text-xs text-amber-300">Approved product authority exists at the platform contract level; this legacy page has not been assigned through the multi-role media adapter.</p></article>
        <article className="min-w-0 bg-zinc-950 p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Contextual In-Use</p><p className={`mt-2 text-xl font-bold ${model.images.contextualInUse.state === "LEGACY_FEATURED" ? "text-sky-300" : "text-amber-300"}`}>{model.images.contextualInUse.state.replaceAll("_", " ")}</p>{model.images.contextualInUse.imageUrl ? <div role="img" aria-label={model.images.contextualInUse.altText ?? "Contextual in-use image"} className="mt-4 aspect-[16/9] bg-zinc-900 bg-contain bg-center bg-no-repeat" style={imageStyle(model.images.contextualInUse.imageUrl)} /> : <div className="mt-4 flex aspect-[16/9] items-center justify-center border border-dashed border-zinc-800 bg-zinc-900 text-sm text-zinc-500">Contextual image unavailable</div>}<p className="mt-4 text-sm text-zinc-300">{model.images.contextualInUse.authority}</p><p className="mt-2 break-words text-xs text-zinc-500">{model.images.contextualInUse.provenance}</p><p className="mt-2 text-xs text-zinc-500">Grounding: {model.images.contextualInUse.grounding}</p>{model.images.contextualInUse.altText ? <p className="mt-2 text-xs text-zinc-500">Alt: {model.images.contextualInUse.altText}</p> : null}</article>
      </div>
      <p className="mt-3 text-xs font-semibold text-amber-300">{model.images.contractState.replaceAll("_", " ")}</p>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="min-w-0 max-w-full border border-zinc-800 bg-zinc-900/45 p-5" aria-label="Content review"><p className="text-xs uppercase tracking-[0.22em] text-red-400">Content Review</p><h2 className="mt-2 text-xl font-bold text-white">Generated structure</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2"><TraceItem label="H1" value={model.source.h1} /><TraceItem label="CTA" value={model.source.cta} /><TraceItem label="FAQ" value={model.source.faqPresent ? "Present" : "Not present"} /><TraceItem label="Internal links" value={model.source.internalLinks.length} /></dl>{model.source.excerpt ? <div className="mt-5 border-l-2 border-red-600 pl-4"><p className="text-xs uppercase text-zinc-500">Intro / excerpt</p><p className="mt-2 text-sm leading-6 text-zinc-300">{model.source.excerpt}</p></div> : null}<div className="mt-5 divide-y divide-zinc-800">{model.source.bodySections.map((section) => <div key={section.heading} className="py-4"><h3 className="font-semibold text-white">{section.heading}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-400">{section.preview}</p></div>)}</div><details className="mt-5 min-w-0 max-w-full border-t border-zinc-800 pt-4"><summary className="cursor-pointer text-sm text-zinc-300">Genesis source / assembly preview</summary><div className="mt-4 min-w-0 max-w-full"><GlwRenderedDraftPreview html={model.source.html} baseUrl={model.wordpress.sourceUrl} label="Genesis Source / Assembly Preview" /></div></details><details className="mt-4"><summary className="cursor-pointer text-xs text-zinc-500">Raw generated HTML</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all bg-zinc-950 p-4 text-xs text-zinc-500">{model.source.rawHtml}</pre></details></section>

      <div className="space-y-6">
        <section className="border border-zinc-800 bg-zinc-900/45 p-5" aria-label="SEO review"><p className="text-xs uppercase tracking-[0.22em] text-red-400">SEO Review</p><div className="mt-4 space-y-4"><div><p className="text-xs text-zinc-500">SEO title · <State value={model.seo.titleState} /></p><p className="mt-1 text-sm text-white">{model.seo.title ?? "Missing"}</p></div><div><p className="text-xs text-zinc-500">Meta description · <State value={model.seo.metaDescriptionState} /></p><p className="mt-1 text-sm text-zinc-300">{model.seo.metaDescription ?? "Missing"}</p></div><div className="grid grid-cols-2 gap-4"><TraceItem label="Canonical" value={model.seo.canonicalState} /><TraceItem label="Redirect evidence" value={model.seo.redirectState} /><TraceItem label="Indexability" value={`${model.seo.indexabilityState} · draft is intentionally non-public`} /><TraceItem label="H1 count" value={`${model.seo.h1Count} · ${model.seo.h1State}`} /><TraceItem label="Dev URL leakage" value={model.seo.developmentUrlLeakState} /></div><p className="text-xs text-zinc-500">{model.seo.detail}</p></div></section>
        <section className="border border-zinc-800 bg-zinc-900/45 p-5" aria-label="Research evidence"><p className="text-xs uppercase tracking-[0.22em] text-red-400">Research and Evidence</p><div className="mt-4 divide-y divide-zinc-800">{model.evidence.map((item, index) => <div key={`${item.source}-${index}`} className="py-3"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-white">{item.source}</p><span className="text-xs text-emerald-300">{item.status}</span></div><p className="mt-1 text-xs text-zinc-500">Used for: {item.usedFor}</p></div>)}</div></section>
        <section className="border border-zinc-800 bg-zinc-900/45 p-5" aria-label="Generation QA"><p className="text-xs uppercase tracking-[0.22em] text-red-400">Generation QA</p><div className="mt-4 divide-y divide-zinc-800">{model.qaChecks.map((check) => <div key={check.label} className="py-3"><div className="flex items-start justify-between gap-3"><p className="text-sm capitalize text-zinc-300">{check.label}</p><State value={check.state} /></div><p className="mt-1 text-xs text-zinc-500">{check.detail}</p></div>)}</div></section>
      </div>
    </div>

    <section className="border border-zinc-800 bg-zinc-950/60 p-5" aria-label="Generation execution trace"><p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Generation / Execution Trace</p><dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><TraceItem label="Job ID" value={model.trace.jobId} /><TraceItem label="External execution" value={model.trace.externalExecutionId} /><TraceItem label="Generation" value={model.trace.generationState} /><TraceItem label="Reconciliation" value={model.trace.reconciliationState} /><TraceItem label="WordPress object" value={model.trace.wordpressObjectId ? `#${model.trace.wordpressObjectId}` : null} /><TraceItem label="Attempt count" value={model.trace.attemptCount} /><TraceItem label="Last activity" value={model.trace.lastActivity} /><TraceItem label="Review decision" value="No durable campaign page-review decision exists" /></dl></section>
  </div>;
}