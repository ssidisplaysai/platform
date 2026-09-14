import React from "react";
import type { GeneratedPageReviewModel } from "./generated-page-review-read-model";

/* eslint-disable @next/next/no-img-element */

type Preview = GeneratedPageReviewModel["richComposition"]["preview"];

export function GlwRichCompositionPreview({ preview, compact = false }: { preview: Preview; compact?: boolean }) {
  const heroStyle = preview.contextualImageUrl ? { backgroundImage: `linear-gradient(90deg,rgba(12,18,20,.94),rgba(12,18,20,.62)),url("${preview.contextualImageUrl.replaceAll('"', "%22")}")` } : undefined;
  return <article className="overflow-hidden bg-[#f4f3ef] text-[#172022]" data-preview-authority="NON_MUTATING" data-composition-profile="LOCATION_SERVICE">
    <div className="flex min-h-11 items-center justify-between gap-4 bg-[#b42318] px-5 py-3 text-xs font-bold uppercase text-white sm:px-8">
      <span>Preview - Not Applied to WordPress</span><span className="hidden text-white/75 sm:inline">Genesis Rich Page Composition V1</span>
    </div>
    <header className="flex items-center justify-between border-b border-[#d7d4cc] bg-white px-5 py-4 sm:px-8"><span className="text-sm font-black uppercase tracking-[0.16em] text-[#172022]">Projector Enclosure</span><span className="text-xs font-semibold uppercase text-[#66706f]">Fan-cooled systems</span></header>
    <section className={`flex flex-col justify-end bg-[#172022] bg-cover bg-center px-5 py-12 text-white sm:px-8 ${compact ? "min-h-[360px]" : "min-h-[520px] lg:px-[8vw]"}`} style={heroStyle} data-media-role="CONTEXTUAL_IN_USE">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#efb24a]">{preview.locationLabel}</p>
      <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.02] sm:text-6xl">{preview.title}</h1>
      {preview.excerpt ? <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">{preview.excerpt}</p> : null}
      {preview.ctaLabel ? <span className="mt-7 inline-flex w-fit bg-[#efb24a] px-5 py-3 text-sm font-bold text-[#172022]">{preview.ctaLabel}</span> : null}
    </section>
    <section className={`grid items-center gap-8 border-b border-[#d7d4cc] bg-white px-5 py-12 sm:px-8 ${compact ? "lg:grid-cols-2" : "lg:grid-cols-[1.08fr_.92fr] lg:px-[8vw] lg:py-20"}`} data-media-role="PRODUCT_AUTHORITY">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b42318]">Approved Product Authority</p><h2 className="mt-3 text-3xl font-black leading-tight text-[#172022] sm:text-4xl">{preview.productName}</h2><p className="mt-4 max-w-xl text-base leading-7 text-[#505b5b]">Built-in fan cooling, durable metal construction, and removable or hinged access panels for indoor, covered outdoor, and mild-environment commercial AV installations.</p><p className="mt-5 text-xs font-semibold uppercase text-[#66706f]">Assigned for preview · Not rendered in current WordPress</p></div>
      {preview.productImageUrl ? <figure className="border border-[#d7d4cc] bg-[#eef0ed] p-4"><img src={preview.productImageUrl} alt={preview.productAltText ?? "Fan-cooled projector enclosure"} className="aspect-[20/9] h-auto w-full object-contain" /><figcaption className="mt-3 text-xs text-[#66706f]">Owner-approved canonical product media</figcaption></figure> : <div className="border border-red-300 bg-red-50 p-5 text-sm font-semibold text-red-900">Required product authority media unresolved. Owner review is blocked.</div>}
    </section>
    <section className={`bg-[#f4f3ef] px-5 py-12 sm:px-8 ${compact ? "" : "lg:px-[8vw] lg:py-20"}`}>
      <div className="mx-auto max-w-[1120px] columns-1 gap-12 [&_a]:font-bold [&_a]:text-[#a61b13] [&_dd]:mb-4 [&_dt]:font-bold [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:break-after-avoid [&_h2]:text-2xl [&_h2]:font-black [&_h2]:leading-tight [&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:font-bold [&_li]:mb-2 [&_p]:mb-5 [&_p]:max-w-[72ch] [&_p]:leading-7 [&_table]:w-full [&_table]:table-fixed [&_td]:break-words [&_td]:border [&_td]:border-[#d7d4cc] [&_td]:p-2 [&_th]:break-words [&_th]:border [&_th]:border-[#d7d4cc] [&_th]:p-2 max-lg:[&_table]:text-xs lg:columns-2" dangerouslySetInnerHTML={{ __html: preview.bodyHtml }} />
    </section>
    <footer className="border-t border-[#d7d4cc] bg-[#172022] px-5 py-8 text-xs text-white/65 sm:px-8"><p>Composition preview only. No WordPress update, publication, campaign transition, or dispatch is performed.</p></footer>
  </article>;
}