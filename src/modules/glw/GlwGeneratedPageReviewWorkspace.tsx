import React from "react";
import Link from "next/link";
import type {
  GeneratedPageReviewModel,
  ReviewSignal,
} from "./generated-page-review-read-model";
import { GlwRenderedDraftPreview } from "./GlwRenderedDraftPreview";
import { GlwRichCompositionPreview } from "./GlwRichCompositionPreview";
import { GlwVisualReviewAction } from "./GlwVisualReviewAction";
import { GlwOwnerReviewDecisionAction } from "./GlwOwnerReviewDecisionAction";
import { GlwGeneratedContextualMediaRepairAction } from "./GlwGeneratedContextualMediaRepairAction";
import { GlwPublishPageAction } from "./GlwPublishPageAction";

const stateTone: Record<
  ReviewSignal | GeneratedPageReviewModel["reviewState"],
  string
> = {
  PASS: "text-emerald-300",
  WARNING: "text-amber-300",
  BLOCKED: "text-red-300",
  NOT_EVALUATED: "text-zinc-500",
  READY_FOR_OWNER_REVIEW: "text-emerald-300",
  NEEDS_ATTENTION: "text-amber-300",
  REVIEW_BLOCKED: "text-red-300",
};

function State({ value }: { value: ReviewSignal }) {
  return (
    <span className={`text-xs font-semibold ${stateTone[value]}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
function TraceItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-zinc-600">
        {label}
      </dt>
      <dd className="mt-1 break-all text-sm text-zinc-300">
        {value ?? "Not available"}
      </dd>
    </div>
  );
}
function artifactImage(reference: string): string | null {
  return /^(?:https?:\/\/|\/)/.test(reference) ? reference : null;
}

export function GlwGeneratedPageReviewWorkspace({
  model,
}: {
  model: GeneratedPageReviewModel;
}) {
  const imageStyle = (url: string) => ({
    backgroundImage: `url("${url.replaceAll('"', "%22")}")`,
  });
  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <nav
        className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-wider text-zinc-400"
        aria-label="Review navigation"
      >
        <Link href={model.actions.listHref} className="hover:text-white">
          Campaign list
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={model.actions.campaignHref} className="hover:text-white">
          Campaign detail
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-white">Page review</span>
      </nav>

      <header className="border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <p
              className={`text-xs font-semibold uppercase tracking-[0.25em] ${stateTone[model.reviewState]}`}
            >
              {model.reviewState.replaceAll("_", " ")}
            </p>
            <h1 className="mt-3 break-words text-3xl font-black text-white">
              {model.identity.title}
            </h1>
            <p className="mt-2 text-lg text-zinc-300">
              {model.identity.target}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              {model.identity.product} · {model.identity.site}
              {model.identity.domain ? ` · ${model.identity.domain}` : ""}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {model.identity.campaign}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {model.actions.canonical ? (
              <a
                href={model.actions.canonical.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-500"
              >
                {model.actions.canonical.label}
              </a>
            ) : null}
            <Link
              href={model.actions.campaignHref}
              className="inline-flex min-h-11 items-center border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-500"
            >
              Continue Campaign
            </Link>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-zinc-800 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <TraceItem
            label="WordPress"
            value={
              model.wordpress.objectId
                ? `#${model.wordpress.objectId} · ${(model.wordpress.status ?? "unknown").toUpperCase()}`
                : null
            }
          />
          <TraceItem
            label="Lifecycle"
            value={model.identity.lifecycleState
              .replaceAll("_", " ")
              .toUpperCase()}
          />
          <TraceItem
            label="Canonical path"
            value={model.identity.canonicalPath}
          />
          <TraceItem
            label="Policy"
            value={model.identity.publicationPolicy
              .replaceAll("_", " ")
              .toUpperCase()}
          />
        </dl>
      </header>

      {model.wordpressStaging ? (
        <section className="border border-emerald-800 bg-emerald-950/20 p-5" aria-label="Owner-approved WordPress staging">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Owner Composition Approved</p>
              <h2 className="mt-2 text-2xl font-black text-white">WordPress Staged</h2>
              <p className="mt-2 text-sm text-zinc-300">Draft #{model.wordpressStaging.wordpressObjectId} · {model.wordpressStaging.wordpressAuthority.replaceAll("_", " ")} · publication not authorized</p>
            </div>
            <a href={model.wordpressStaging.reviewUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center border border-emerald-700 px-4 py-3 text-sm font-bold text-emerald-200 hover:border-emerald-500">Open WordPress Draft</a>
          </div>
          <dl className="mt-5 grid gap-4 border-t border-emerald-900 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <TraceItem label="Artifact SHA" value={model.wordpressStaging.artifactSha} />
            <TraceItem label="Composition commit" value={model.wordpressStaging.approvedCompositionCommit} />
            <TraceItem label="Stored composition hash" value={model.wordpressStaging.storedCompositionHash} />
            <TraceItem label="Media authority" value={`${model.wordpressStaging.mediaResolved}/4 resolved · product media 10757`} />
            <TraceItem label="Localization" value={model.wordpressStaging.localizationCertification} />
            <TraceItem label="Claims" value={model.wordpressStaging.claimCertification} />
            <TraceItem label="Genesis responsive" value={model.wordpressStaging.genesisResponsiveCertification} />
            <TraceItem label="Native WP preview" value={model.wordpressStaging.nativeWordPressDraftRenderCertified ? "CERTIFIED" : "NOT CERTIFIED"} />
          </dl>
          <p className="mt-4 text-xs leading-5 text-zinc-500">{model.wordpressStaging.nativePreviewLimitation}</p>
        </section>
      ) : null}

      {model.nativeRenderRepair ? (
        <section className="border border-amber-700 bg-amber-950/15 p-5" aria-label="Native WordPress render repair">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Native WordPress Compatibility Repair</p><h2 className="mt-2 text-2xl font-black text-white">Ready for Owner Native Preview</h2><p className="mt-2 text-sm text-zinc-300">Theme title and standalone featured-image presentation are suppressed only for page 13103. Featured media 10757 remains assigned.</p></div>
            {model.wordpressStaging ? <a href={model.wordpressStaging.reviewUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center border border-amber-600 px-4 py-3 text-sm font-bold text-amber-200 hover:border-amber-400">Open WordPress Editor, then Preview</a> : null}
          </div>
          <dl className="mt-5 grid gap-4 border-t border-amber-900 pt-5 sm:grid-cols-2 lg:grid-cols-4"><TraceItem label="Shell contract" value={model.nativeRenderRepair.shellContract} /><TraceItem label="Before hash" value={model.nativeRenderRepair.beforeHash} /><TraceItem label="After hash" value={model.nativeRenderRepair.afterHash} /><TraceItem label="Compatibility gate" value={model.nativeRenderRepair.certificationState} />{model.nativeRenderRepair.captures.map((capture) => <TraceItem key={capture.viewport} label={capture.viewport.replaceAll("_", " ")} value={`overflow ${capture.overflow} · media ${(capture.productMediaRatio * 100).toFixed(0)}% · copy ${Math.round(capture.productCopyWidth)}px · product/context lines ${capture.productHeadingLineCount}/${capture.contextualHeadingLineCount}`} />)}</dl>
          <p className="mt-4 text-xs leading-5 text-zinc-500">Deterministic shell compatibility passed, but native preview automation is unavailable. Open the WordPress editor, click Preview, and visually confirm the repaired native page before any separate publication authorization.</p>
        </section>
      ) : null}

      {model.heroContrastRepair ? (
        <section className="border border-yellow-600 bg-yellow-950/15 p-5" aria-label="San Antonio hero contrast repair">
          <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300">Hero Contrast Repair</p><h2 className="mt-2 text-2xl font-black text-white">Ready for Owner Hero Review</h2><p className="mt-2 text-sm text-zinc-300">The native-shell H1 changed from {model.heroContrastRepair.h1ColorBefore} to {model.heroContrastRepair.h1ColorAfter}. Hero background, copy, CTAs, media, and geometry remain unchanged.</p></div>
          <dl className="mt-5 grid gap-4 border-t border-yellow-900 pt-5 sm:grid-cols-2 lg:grid-cols-4"><TraceItem label="Before hash" value={model.heroContrastRepair.beforeHash} /><TraceItem label="After hash" value={model.heroContrastRepair.afterHash} /><TraceItem label="Contrast gate" value={model.heroContrastRepair.certificationState} />{model.heroContrastRepair.captures.map((capture) => <TraceItem key={capture.viewport} label={capture.viewport.replaceAll("_", " ")} value={`H1 ${capture.h1Contrast.toFixed(2)}:1 · copy ${capture.supportingContrast.toFixed(2)}:1 · CTAs ${Math.min(capture.primaryCtaContrast, capture.secondaryCtaContrast).toFixed(2)}:1 · note ${capture.disclaimerContrast.toFixed(2)}:1 · overlap ${capture.overlap ? "YES" : "NO"} · overflow ${capture.overflow}`} />)}</dl>
          <p className="mt-4 text-xs leading-5 text-zinc-500">Native preview automation remains unavailable. Open the WordPress editor and click Preview to visually approve this contrast repair before any publication authorization.</p>
        </section>
      ) : null}

      {model.backgroundAwareContrast ? (
        <section className="border border-cyan-800 bg-cyan-950/15 p-5" aria-label="Background-aware text contrast">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Genesis Background-Aware Text Contrast V1</p><h2 className="mt-2 text-2xl font-black text-white">Full Render Contrast Audit</h2><p className="mt-2 text-sm text-zinc-300">{model.backgroundAwareContrast.authority.replaceAll("_", " ")} · generated image reevaluation {model.backgroundAwareContrast.generatedImageReevaluationPerformed ? "performed" : "not observed"}</p></div><p className={`text-sm font-bold ${model.backgroundAwareContrast.state === "PASS" ? "text-emerald-300" : "text-red-300"}`}>{model.backgroundAwareContrast.state} · {model.backgroundAwareContrast.failureCount} failures</p></div>
          <dl className="mt-5 grid gap-4 border-t border-cyan-900 pt-5 sm:grid-cols-2 lg:grid-cols-4"><TraceItem label="Owner review contrast gate" value={model.backgroundAwareContrast.ownerReviewReady ? "PASS" : "BLOCKED"} /><TraceItem label="Host publication contrast gate" value={model.backgroundAwareContrast.publicationReady ? "PASS" : "BLOCKED"} />{model.backgroundAwareContrast.viewports.map((viewport) => <TraceItem key={viewport.viewport} label={viewport.viewport.replaceAll("_", " ")} value={`${viewport.observations} observations · ${viewport.failures} failures`} />)}</dl>
          <p className="mt-4 text-xs leading-5 text-zinc-500">A PASS host-render contrast gate is required evidence for future publication readiness. It is not publication authorization and exposes no Publish action.</p>
        </section>
      ) : null}

      <section
        className="border border-zinc-800 bg-zinc-900/45 p-5"
        aria-label="Review issues"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
              Review Summary
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">
              Issues and safe continuation
            </h2>
          </div>
          <p
            className={`text-sm font-semibold ${stateTone[model.reviewState]}`}
          >
            {model.reviewState.replaceAll("_", " ")}
          </p>
        </div>
        <div className="mt-4 divide-y divide-zinc-800">
          {model.issues.map((issue, index) => (
            <div
              key={`${issue.category}-${index}`}
              className="grid gap-2 py-4 md:grid-cols-[8rem_1fr_1fr]"
            >
              <p className="text-xs font-semibold text-zinc-400">
                {issue.category} · {issue.severity}
              </p>
              <div>
                <p className="font-semibold text-white">{issue.what}</p>
                <p className="mt-1 text-sm text-zinc-400">{issue.effect}</p>
              </div>
              <p className="text-sm text-zinc-300">
                Safe next step: {issue.safeNextStep}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="border border-zinc-800 bg-zinc-900/45 p-5"
        aria-label="Localization QA"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-red-400">
              Localization QA
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">
              Owner-visible location contamination
            </h2>
          </div>
          <State
            value={model.localizationQa.state === "FAIL" ? "BLOCKED" : "PASS"}
          />
        </div>
        <p className="mt-3 text-sm text-zinc-400">
          {model.localizationQa.contract} ·{" "}
          {model.localizationQa.occurrences.length} governed location occurrence
          {model.localizationQa.occurrences.length === 1 ? "" : "s"} inspected
        </p>
        {model.localizationQa.forbiddenOccurrences.length ? (
          <div className="mt-4 border border-red-800 bg-red-950/25 p-4">
            {model.localizationQa.forbiddenOccurrences.map(
              (occurrence, index) => (
                <p
                  key={`${occurrence.token}-${occurrence.source}-${index}`}
                  className="text-sm text-red-200"
                >
                  {occurrence.token} · {occurrence.source.replaceAll("_", " ")}{" "}
                  · {occurrence.authority}
                </p>
              ),
            )}
          </div>
        ) : null}
      </section>

      <section
        className="min-w-0 max-w-full border border-zinc-800 bg-zinc-900/45 p-5"
        aria-label="Actual WordPress draft preview"
      >
        {model.wordpress.previewHtml ? (
          <>
            <div className="mb-4 flex flex-wrap gap-3 text-xs text-zinc-400">
              <span>
                Identity {model.wordpress.verified ? "VERIFIED" : "ATTENTION"}
              </span>
              <span>
                Title {model.wordpress.titleMatchesSource ? "MATCH" : "DIFFERS"}
              </span>
              <span>
                Content{" "}
                {model.wordpress.contentMatchesSource ? "MATCH" : "DIFFERS"}
              </span>
            </div>
            <GlwRenderedDraftPreview
              html={model.wordpress.previewHtml}
              baseUrl={model.wordpress.sourceUrl}
              label="Actual WordPress Draft"
            />
          </>
        ) : (
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-red-400">
              Actual WordPress Draft
            </p>
            <p className="mt-3 text-sm text-amber-300">
              Authenticated draft content is unavailable:{" "}
              {model.wordpress.readState.replaceAll("_", " ")}.
            </p>
          </div>
        )}
      </section>

      <section
        className="border border-zinc-800 bg-zinc-900/45 p-5"
        aria-label="Rich page composition plan"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-red-400">
              Rich Page Composition V1
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">
              Current render and proposed plan
            </h2>
          </div>
          <div className="text-right">
            <p
              className={`text-sm font-bold ${model.richComposition.plan.validationState === "READY" ? "text-emerald-300" : "text-amber-300"}`}
            >
              {model.richComposition.plan.validationState}
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">
              IDENTITY {model.richComposition.identityState}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-px bg-zinc-800 lg:grid-cols-2">
          <article className="bg-zinc-950 p-5">
            <p className="text-xs font-bold text-zinc-500">CURRENT RENDER</p>
            <p className="mt-3 text-lg font-bold text-white">
              {model.richComposition.currentRender.profile.replaceAll("_", " ")}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Visual certification:{" "}
              {model.richComposition.currentRender.certificationState.replaceAll(
                "_",
                " ",
              )}{" "}
              ·{" "}
              {model.richComposition.currentRender.overallState.replaceAll(
                "_",
                " ",
              )}
            </p>
            <p className="mt-4 text-sm text-zinc-300">
              The current WordPress draft remains unchanged. This panel creates
              no render, dispatch, publication, or approval action.
            </p>
          </article>
          <article className="bg-zinc-950 p-5">
            <p className="text-xs font-bold text-zinc-500">
              PROPOSED COMPOSITION PLAN
            </p>
            <p className="mt-3 text-lg font-bold text-white">
              {model.richComposition.plan.profile.replaceAll("_", " ")}
            </p>
            <p className="mt-2 break-all text-xs text-zinc-600">
              {model.richComposition.plan.contract} ·{" "}
              {model.richComposition.plan.identity.pageRevisionIdentity}
            </p>
            <p className="mt-4 text-sm text-zinc-300">
              A richer location-service structure, constrained by current
              content and media authority.
            </p>
          </article>
        </div>
        <div className="mt-5">
          <p className="text-xs uppercase text-zinc-500">
            Planned section structure
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {model.richComposition.plan.sections.map((section, index) => (
              <article
                key={section.sectionId}
                className="border border-zinc-800 bg-zinc-950 p-3"
              >
                <p className="text-[11px] text-red-400">
                  {String(index + 1).padStart(2, "0")} ·{" "}
                  {section.role.replaceAll("_", " ")}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {section.layoutIntent.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {section.widthIntent} ·{" "}
                  {section.responsiveIntent.replaceAll("_", " ")}
                </p>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {model.richComposition.plan.media.map((media) => (
            <article
              key={media.slotId}
              className={`border p-4 ${media.readiness === "READY" || media.readiness === "LEGACY" ? "border-zinc-700" : "border-amber-800 bg-amber-950/20"}`}
            >
              <div className="flex justify-between gap-3">
                <p className="text-sm font-bold text-white">
                  {media.role.replaceAll("_", " ")}
                </p>
                <p
                  className={`text-xs font-bold ${media.readiness === "NOT_WIRED" ? "text-amber-300" : "text-sky-300"}`}
                >
                  {media.readiness.replaceAll("_", " ")}
                </p>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {media.requirement} · {media.provenance}
              </p>
            </article>
          ))}
        </div>
        {model.richComposition.plan.blockers.length ? (
          <div className="mt-5 border border-amber-800 bg-amber-950/20 p-4">
            <p className="text-sm font-bold text-amber-200">
              Unresolved blockers
            </p>
            {model.richComposition.plan.blockers.map((blocker) => (
              <p key={blocker} className="mt-2 text-sm text-amber-300">
                {blocker.replaceAll("_", " ")}
              </p>
            ))}
          </div>
        ) : null}
        <div className="mt-5 divide-y divide-zinc-800">
          <p className="pb-2 text-xs uppercase text-zinc-500">
            Composition expectations
          </p>
          {model.richComposition.proposedFindings.map((finding) => (
            <div
              key={finding.code}
              className="grid gap-2 py-3 md:grid-cols-[12rem_1fr]"
            >
              <p className="text-xs">
                <State
                  value={finding.state === "FAIL" ? "BLOCKED" : finding.state}
                />{" "}
                · {finding.code.replaceAll("_", " ")}
              </p>
              <p className="text-sm text-zinc-400">
                {finding.summary}
                {finding.advisory ? " Advisory." : ""}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-zinc-800 pt-4">
          <p className="text-xs uppercase text-zinc-500">Safe Next Action</p>
          <p className="mt-2 text-sm text-zinc-300">
            {model.richComposition.safeNextAction}
          </p>
          <p className="mt-3 text-xs text-zinc-600">
            Planning evidence only. Visual approval and publication remain
            independent.
          </p>
        </div>
        <div className="mt-5 border-t border-zinc-800 pt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-red-400">
                Non-mutating owner preview
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Uses current generated copy, assigned product authority, and
                legacy contextual media.
              </p>
            </div>
            <Link
              href={model.richComposition.preview.href}
              target="_blank"
              className="border border-zinc-700 px-4 py-2 text-xs font-bold text-white hover:border-zinc-500"
            >
              Open full preview
            </Link>
          </div>
          <GlwRichCompositionPreview
            preview={model.richComposition.preview}
            compact
          />
        </div>
      </section>

      {model.localizedV2 ? (
        <section
          className="border border-zinc-800 bg-zinc-900/45 p-5"
          aria-label="Proposed localized rich composition V2"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
                Proposed Localized Rich Composition V2
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">
                ProjectorEnclosure × {model.identity.target}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-300">
                {model.localizedV2.state.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                LOCALIZATION LEVEL {model.localizedV2.localizationLevel}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-px bg-zinc-800 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-zinc-950 p-4">
              <TraceItem
                label="Local context"
                value={`${model.localizedV2.contextFacts} sourced facts`}
              />
            </div>
            <div className="bg-zinc-950 p-4">
              <TraceItem
                label="Applications"
                value={`${model.localizedV2.applications.filter((item) => item.state === "SUPPORTED").length} supported`}
              />
            </div>
            <div className="bg-zinc-950 p-4">
              <TraceItem
                label="Link graph"
                value={`${Object.values(model.localizedV2.linkCounts).reduce((sum, count) => sum + count, 0)} verified links`}
              />
            </div>
            <div className="bg-zinc-950 p-4">
              <TraceItem
                label="Blockers"
                value={
                  model.localizedV2.blockers.length
                    ? model.localizedV2.blockers.join(", ")
                    : "None"
                }
              />
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {model.localizedV2.media.map((item) => (
              <article
                key={item.role}
                className="border border-zinc-800 bg-zinc-950 p-4"
              >
                <p className="text-sm font-bold text-white">
                  {item.role.replaceAll("_", " ")}
                </p>
                <p className="mt-2 text-xs text-sky-300">
                  {item.claimClass.replaceAll("_", " ")}
                </p>
                <p
                  className={`mt-1 text-xs ${item.reviewState === "APPROVED" ? "text-emerald-300" : "text-amber-300"}`}
                >
                  OWNER {item.reviewState}
                </p>
                <p className="mt-3 text-[11px] text-zinc-500">
                  {item.source.replaceAll("_", " ")}
                </p>
                <p className="mt-1 break-all text-[10px] text-zinc-600">
                  {item.productTruthReference ?? "No documentary product claim"}
                  {" · "}
                  {item.sha256}
                </p>
                <p className="mt-2 text-xs text-zinc-400">Alt: {item.altText}</p>
              </article>
            ))}
          </div>
          {model.localizedV2.visualCertification ? (
            <div className="mt-5 border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <p className="text-xs font-bold uppercase text-zinc-500">
                  Local-theme visual certification
                </p>
                <p className="text-xs font-bold text-amber-300">
                  {model.localizedV2.visualCertification.state.replaceAll(
                    "_",
                    " ",
                  )}{" "}
                  · OWNER REVIEW REQUIRED
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {model.localizedV2.visualCertification.viewports.map(
                  (viewport) => (
                    <span
                      key={viewport.label}
                      className="border border-zinc-700 px-3 py-2 text-xs text-zinc-300"
                    >
                      {viewport.label.replaceAll("_", " ")} ·{" "}
                      {viewport.overflow}px overflow
                    </span>
                  ),
                )}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {model.localizedV2.visualCertification.viewports.map(
                  (viewport) => (
                    <article
                      key={`${viewport.label}-capture`}
                      className="min-w-0 border border-zinc-800 bg-zinc-900 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-white">
                          {viewport.label.replaceAll("_", " ")}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {viewport.width} × {viewport.height}
                        </p>
                      </div>
                      <div
                        role="img"
                        aria-label={`${viewport.label.replaceAll("_", " ")} certified San Antonio composition capture`}
                        className="mt-3 aspect-video bg-zinc-950 bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url("${viewport.artifactUrl.replaceAll('"', "%22")}")` }}
                      />
                      <p className="mt-2 break-all text-[10px] text-zinc-600">
                        SHA-256 {viewport.sha256}
                      </p>
                    </article>
                  ),
                )}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {model.localizedV2.visualCertification.findings.map(
                  (finding) => (
                    <p
                      key={finding.code}
                      className={`text-xs ${finding.state === "PASS" ? "text-emerald-300" : "text-amber-300"}`}
                    >
                      {finding.state} · {finding.code.replaceAll("_", " ")}
                    </p>
                  ),
                )}
              </div>
            </div>
          ) : null}
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs font-bold uppercase text-zinc-500">
                What changed from V1
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Added source-grounded local context, projection-mapping
                application authority, a verified internal/local link graph,
                Level {model.localizedV2.localizationLevel} brand expression,
                and distinct in-use, application-experience, and atmospheric
                media candidates.
              </p>
              <p className="mt-3 text-xs text-emerald-300">
                Brand authority preserved · False proximity prohibited ·
                Anti-cliché safeguards active
              </p>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs font-bold uppercase text-zinc-500">
                Owner review questions
              </p>
              {model.localizedV2.ownerQuestions.map((question) => (
                <p key={question} className="mt-2 text-sm text-zinc-300">
                  □ {question}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-5">
            <p className="text-xs text-zinc-500">
              Preview evidence only. Generated media remains owner-review
              pending. No Apply control exists.
            </p>
            <Link
              href={model.localizedV2.href}
              target="_blank"
              className="bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-500"
            >
              Open Full Preview
            </Link>
          </div>
        </section>
      ) : null}

      {model.marketMatch ? (
        <section
          className="border border-zinc-800 bg-zinc-900/45 p-5"
          aria-label="Market match"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
                Market Match
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">
                What should this page emphasize?
              </h2>
            </div>
            <p className="text-xs text-zinc-500">
              {model.marketMatch.signalCount} signals ·{" "}
              {model.marketMatch.catalogCount} catalog items evaluated
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {model.marketMatch.ranked.slice(0, 3).map((item, index) => (
              <article
                key={item.application}
                className="border border-zinc-800 bg-zinc-950 p-4"
              >
                <p className="text-[11px] font-bold text-zinc-500">
                  #{index + 1}
                </p>
                <p className="mt-2 font-bold text-white">
                  {item.application.replaceAll("_", " ")}
                </p>
                <p
                  className={`mt-2 text-xs font-bold ${item.confidence === "HIGH" ? "text-emerald-300" : "text-sky-300"}`}
                >
                  {item.confidence.replaceAll("_", " ")}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {item.product ?? "No approved match"}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-5 border-t border-zinc-800 pt-4 text-sm text-zinc-300">
            <p>
              Primary:{" "}
              {model.marketMatch.pageStrategy.primary?.replaceAll("_", " ")}
            </p>
            <p className="mt-1">
              Supporting:{" "}
              {model.marketMatch.pageStrategy.supporting
                .join(" · ")
                .replaceAll("_", " ")}
            </p>
            <p className="mt-1">
              Cross-sell selected:{" "}
              {model.marketMatch.pageStrategy.crossSell.length || "None"} ·
              Rejected/insufficient: {model.marketMatch.pageStrategy.rejected}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={model.marketMatch.href}
              className="border border-zinc-700 px-4 py-3 text-sm font-bold text-white"
            >
              Open opportunity matrix
            </Link>
            <Link
              href={model.marketMatch.previewV3Href}
              target="_blank"
              className="bg-red-600 px-4 py-3 text-sm font-bold text-white"
            >
              Open market-informed V3 preview
            </Link>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Recommendation only. No campaign, page, site, dispatch, or
            publication mutation is authorized.
          </p>
        </section>
      ) : null}
      {model.referencePage ? (
        <section
          className="border border-emerald-700 bg-emerald-950/25 p-5"
          aria-label="Certified Dallas reference page"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-300">
                Published · Public Verified · Visual Certified · Reference Page
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">
                Dallas Genesis reference implementation
              </h2>
            </div>
            <p className="text-xs font-bold text-emerald-300">
              {model.referencePage.state}
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TraceItem
              label="Publication receipt"
              value={model.referencePage.publicationReceiptId}
            />
            <TraceItem
              label="Owner approval"
              value={model.referencePage.ownerApprovalId}
            />
            <TraceItem
              label="Public visual certification"
              value={model.referencePage.visualCertificationId}
            />
            <TraceItem
              label="Reference certification"
              value={model.referencePage.certificationId}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={model.referencePage.href}
              className="bg-emerald-700 px-5 py-3 text-sm font-bold text-white"
            >
              Open reference evidence
            </Link>
            <Link
              href={model.referencePage.publicUrl}
              target="_blank"
              className="border border-zinc-700 px-5 py-3 text-sm font-bold text-white"
            >
              Open public Dallas page
            </Link>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Houston is only a recommendation and requires separate dispatch
            authorization.
          </p>
        </section>
      ) : model.appliedV3 ? (
        <section
          className="border border-emerald-900 bg-emerald-950/20 p-5"
          aria-label="Applied V3 WordPress draft"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-300">
                Applied V3 · WordPress Draft
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">
                Exact readback and owner comparison ready
              </h2>
            </div>
            <p className="text-xs font-bold text-amber-300">
              DRIFT {model.appliedV3.drift ?? "PENDING"} · OWNER REVIEW REQUIRED
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TraceItem
              label="Mutation receipt"
              value={model.appliedV3.receiptId}
            />
            <TraceItem
              label="Owner decision"
              value={model.appliedV3.decisionId}
            />
            <TraceItem label="Before hash" value={model.appliedV3.beforeHash} />
            <TraceItem label="After hash" value={model.appliedV3.afterHash} />
          </div>
          <Link
            href={model.appliedV3.comparisonHref}
            className="mt-5 inline-flex bg-emerald-700 px-5 py-3 text-sm font-bold text-white"
          >
            Review actual WordPress captures
          </Link>
          <p className="mt-3 text-xs text-zinc-500">
            Draft only. No publication control is exposed.
          </p>
        </section>
      ) : null}
      {model.themeIntegration ? (
        <section
          className="border border-sky-800 bg-sky-950/20 p-5"
          aria-label="Theme integration review"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.22em] text-sky-300">
                Theme-integrated draft
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">
                Cerato integration repaired
              </h2>
            </div>
            <p className="text-xs font-bold text-emerald-300">
              THEME INTEGRATION READY
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TraceItem
              label="Visible H1"
              value={String(model.themeIntegration.visibleH1Count)}
            />
            <TraceItem
              label="1024 overflow"
              value={`${model.themeIntegration.overflow1024}px`}
            />
            <TraceItem
              label="Composition drift"
              value={model.themeIntegration.drift}
            />
            <TraceItem
              label="Certification"
              value={model.themeIntegration.certificationId}
            />
          </div>
          <Link
            href={model.themeIntegration.href}
            className="mt-5 inline-flex bg-sky-700 px-5 py-3 text-sm font-bold text-white"
          >
            Review repaired theme captures
          </Link>
          <p className="mt-3 text-xs text-zinc-500">
            Owner review only. No publication control is exposed.
          </p>
        </section>
      ) : null}

      <section
        className="border border-zinc-800 bg-zinc-900/45 p-5"
        aria-label="Rendered visual QA"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-red-400">
              Visual Review
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">
              Rendered Visual Certification
            </h2>
          </div>
          <div className="text-right">
            <State value={model.visualQa.overallState} />
            <p className="mt-1 text-[11px] uppercase text-zinc-600">
              {model.visualQa.certificationState.replaceAll("_", " ")}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <GlwVisualReviewAction
            {...model.actions.visualCapture}
            state={model.visualQa.certificationState}
          />
        </div>
        {model.actions.ownerDecision ? (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <GlwOwnerReviewDecisionAction
              {...model.actions.ownerDecision}
              currentDecision={model.visualQa.decision?.decision ?? null}
            />
          </div>
        ) : null}
        {model.actions.publish ? (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <GlwPublishPageAction
              endpoint={model.actions.publish.endpoint}
              organizationId={model.actions.publish.organizationId}
              siteId={model.actions.publish.siteId}
              targetId={model.actions.publish.targetId}
            />
          </div>
        ) : null}
        {model.visualQa.stale ? (
          <div className="mt-4 border border-amber-700 bg-amber-950/25 p-4">
            <p className="font-semibold text-amber-200">VISUAL REVIEW STALE</p>
            <p className="mt-1 text-sm text-amber-300">
              The stored capture set does not match the current page revision or
              render identity.
            </p>
          </div>
        ) : null}
        {model.visualQa.captures.length > 0 ? (
          <div className="mt-5 grid gap-px bg-zinc-800 lg:grid-cols-2">
            {model.visualQa.captures.map((capture) => {
              const preview = artifactImage(capture.artifactReference);
              return (
                <article
                  key={capture.captureId}
                  className="min-w-0 bg-zinc-950 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-white">
                        {capture.viewportClass} Capture
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-600">
                        {capture.captureId}
                      </p>
                    </div>
                    <State
                      value={
                        capture.horizontalOverflow > 0 ? "BLOCKED" : "PASS"
                      }
                    />
                  </div>
                  {preview ? (
                    <div
                      role="img"
                      aria-label={`${capture.viewportClass} visual certification capture`}
                      className="mt-4 aspect-video bg-zinc-900 bg-contain bg-center bg-no-repeat"
                      style={{
                        backgroundImage: `url("${preview.replaceAll('"', "%22")}")`,
                      }}
                    />
                  ) : (
                    <div className="mt-4 flex aspect-video items-center justify-center border border-dashed border-zinc-800 text-xs text-zinc-600">
                      Artifact stored outside browser-accessible media
                    </div>
                  )}
                  <dl className="mt-4 grid grid-cols-2 gap-3">
                    <TraceItem
                      label="Viewport"
                      value={`${capture.viewportWidth} × ${capture.viewportHeight}`}
                    />
                    <TraceItem
                      label="Document"
                      value={`${capture.documentWidth} × ${capture.documentHeight}`}
                    />
                    <TraceItem
                      label="Content width"
                      value={
                        capture.primaryContentWidth === null
                          ? null
                          : `${Math.round(capture.primaryContentWidth)}px`
                      }
                    />
                    <TraceItem
                      label="Utilization"
                      value={
                        capture.utilization === null
                          ? null
                          : `${Math.round(capture.utilization * 100)}%`
                      }
                    />
                    <TraceItem
                      label="Overflow"
                      value={`${capture.horizontalOverflow}px`}
                    />
                    <TraceItem
                      label="Hero"
                      value={capture.heroState.replaceAll("_", " ")}
                    />
                    <TraceItem
                      label="Media rendered"
                      value={`${capture.mediaRendered}/${capture.mediaAssigned} assigned`}
                    />
                    <TraceItem label="Sections" value={capture.sectionCount} />
                  </dl>
                  <details className="mt-4 border-t border-zinc-800 pt-3">
                    <summary className="cursor-pointer text-xs text-zinc-400">
                      Artifact identity
                    </summary>
                    <p className="mt-2 break-all text-xs text-zinc-600">
                      {capture.artifactReference}
                    </p>
                    <code className="mt-1 block break-all text-[11px] text-zinc-700">
                      SHA-256 {capture.artifactSha256}
                    </code>
                  </details>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 border border-dashed border-zinc-800 p-5 text-sm text-zinc-400">
            <p className="font-semibold text-white">
              Desktop Capture · NOT EVALUATED
            </p>
            <p className="mt-2">Mobile Capture · NOT EVALUATED</p>
            <p className="mt-3 text-xs text-zinc-500">
              No persisted capture set matches this page revision.
            </p>
          </div>
        )}
        {model.visualQa.findings.length > 0 ? (
          <div className="mt-5 divide-y divide-zinc-800">
            <p className="pb-3 text-xs uppercase tracking-wider text-zinc-500">
              Findings
            </p>
            {model.visualQa.findings.map((finding) => (
              <div
                key={finding.findingCode}
                className="grid gap-2 py-3 md:grid-cols-[9rem_1fr]"
              >
                <p className="text-xs">
                  <State value={finding.state} /> · {finding.category}
                </p>
                <div>
                  <p className="text-sm text-white">{finding.summary}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Rule {finding.rule.ruleId} · {finding.rule.version}
                  </p>
                  {finding.safeRecommendation ? (
                    <p className="mt-1 text-xs text-zinc-400">
                      Safe recommendation: {finding.safeRecommendation}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 border-t border-zinc-800 pt-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-zinc-500">Owner Decision</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {model.visualQa.decision?.decision.replaceAll("_", " ") ??
                "PENDING"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Evidence currency: {model.visualQa.decisionState}
            </p>
            {model.visualQa.decision?.note ? (
              <p className="mt-2 text-xs text-zinc-400">
                {model.visualQa.decision.note}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Safe Next Step</p>
            <p className="mt-2 text-sm text-zinc-300">
              {model.visualQa.safeNextStep}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-600">{model.visualQa.authority}</p>
        <p className="mt-2 text-xs text-zinc-500">
          Visual approval is independent from publication, campaign activation,
          content QA, and launch certification.
        </p>
      </section>

      <section
        className="border border-zinc-800 bg-zinc-900/45 p-5"
        aria-label="Image review"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-red-400">
            Image Review
          </p>
          <h2 className="mt-2 text-xl font-bold text-white">
            Product truth and in-use context
          </h2>
        </div>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-px bg-zinc-800 lg:grid-cols-2">
          <article className="min-w-0 bg-zinc-950 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Product Authority
            </p>
            <p
              className={`mt-2 text-xl font-bold ${model.images.productAuthority.state === "ASSIGNED" ? "text-emerald-300" : "text-amber-300"}`}
            >
              {model.images.productAuthority.state}
            </p>
            {model.images.productAuthority.imageUrl ? (
              <div
                role="img"
                aria-label={
                  model.images.productAuthority.altText ??
                  "Approved product image"
                }
                className="mt-4 aspect-[16/9] bg-zinc-900 bg-contain bg-center bg-no-repeat"
                style={imageStyle(model.images.productAuthority.imageUrl)}
              />
            ) : (
              <div className="mt-4 flex aspect-[16/9] items-center justify-center border border-dashed border-zinc-800 bg-zinc-900 text-center text-sm text-zinc-500">
                No target-level product image assignment
              </div>
            )}
            <p className="mt-4 text-sm text-zinc-300">
              {model.images.productAuthority.authority}
            </p>
            <p className="mt-2 break-all text-xs text-zinc-500">
              {model.images.productAuthority.provenance}
            </p>
            {model.images.productAuthority.altText ? (
              <p className="mt-2 text-xs text-zinc-500">
                Alt: {model.images.productAuthority.altText}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-amber-300">
              {model.images.productAuthority.renderedInCurrentWordPress
                ? "Rendered in current WordPress."
                : "Assigned for planning and preview; not rendered in current WordPress."}
            </p>
          </article>
          <article className="min-w-0 bg-zinc-950 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Contextual In-Use
            </p>
            <p
              className={`mt-2 text-xl font-bold ${model.images.contextualInUse.state === "LEGACY_FEATURED" ? "text-sky-300" : "text-amber-300"}`}
            >
              {model.images.contextualInUse.state.replaceAll("_", " ")}
            </p>
            {model.images.contextualInUse.imageUrl ? (
              <div
                role="img"
                aria-label={
                  model.images.contextualInUse.altText ??
                  "Contextual in-use image"
                }
                className="mt-4 aspect-[16/9] bg-zinc-900 bg-contain bg-center bg-no-repeat"
                style={imageStyle(model.images.contextualInUse.imageUrl)}
              />
            ) : (
              <div className="mt-4 flex aspect-[16/9] items-center justify-center border border-dashed border-zinc-800 bg-zinc-900 text-sm text-zinc-500">
                Contextual image unavailable
              </div>
            )}
            <p className="mt-4 text-sm text-zinc-300">
              {model.images.contextualInUse.authority}
            </p>
            <p className="mt-2 break-words text-xs text-zinc-500">
              {model.images.contextualInUse.provenance}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Grounding: {model.images.contextualInUse.grounding}
            </p>
            {model.images.contextualInUse.altText ? (
              <p className="mt-2 text-xs text-zinc-500">
                Alt: {model.images.contextualInUse.altText}
              </p>
            ) : null}
            {model.actions.generatedContextualRepair ? (
              <GlwGeneratedContextualMediaRepairAction
                endpoint={model.actions.generatedContextualRepair.endpoint}
                organizationId={model.actions.generatedContextualRepair.organizationId}
                siteId={model.actions.generatedContextualRepair.siteId}
                operation={model.actions.generatedContextualRepair.operation}
                label={model.actions.generatedContextualRepair.label}
                identity={model.actions.generatedContextualRepair.identity}
              />
            ) : null}
          </article>
        </div>
        <p className="mt-3 text-xs font-semibold text-amber-300">
          {model.images.contractState.replaceAll("_", " ")}
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section
          className="min-w-0 max-w-full border border-zinc-800 bg-zinc-900/45 p-5"
          aria-label="Content review"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-red-400">
            Content Review
          </p>
          <h2 className="mt-2 text-xl font-bold text-white">
            Generated structure
          </h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <TraceItem label="H1" value={model.source.h1} />
            <TraceItem label="CTA" value={model.source.cta} />
            <TraceItem
              label="FAQ"
              value={model.source.faqPresent ? "Present" : "Not present"}
            />
            <TraceItem
              label="Internal links"
              value={model.source.internalLinks.length}
            />
          </dl>
          {model.source.excerpt ? (
            <div className="mt-5 border-l-2 border-red-600 pl-4">
              <p className="text-xs uppercase text-zinc-500">Intro / excerpt</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                {model.source.excerpt}
              </p>
            </div>
          ) : null}
          <div className="mt-5 divide-y divide-zinc-800">
            {model.source.bodySections.map((section) => (
              <div key={section.heading} className="py-4">
                <h3 className="font-semibold text-white">{section.heading}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-400">
                  {section.preview}
                </p>
              </div>
            ))}
          </div>
          <details className="mt-5 min-w-0 max-w-full border-t border-zinc-800 pt-4">
            <summary className="cursor-pointer text-sm text-zinc-300">
              Genesis source / assembly preview
            </summary>
            <div className="mt-4 min-w-0 max-w-full">
              <GlwRenderedDraftPreview
                html={model.source.html}
                baseUrl={model.wordpress.sourceUrl}
                label="Genesis Source / Assembly Preview"
              />
            </div>
          </details>
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-zinc-500">
              Raw generated HTML
            </summary>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all bg-zinc-950 p-4 text-xs text-zinc-500">
              {model.source.rawHtml}
            </pre>
          </details>
        </section>

        <div className="space-y-6">
          <section
            className="border border-zinc-800 bg-zinc-900/45 p-5"
            aria-label="SEO review"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-red-400">
              SEO Review
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-zinc-500">
                  SEO title · <State value={model.seo.titleState} />
                </p>
                <p className="mt-1 text-sm text-white">
                  {model.seo.title ?? "Missing"}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">
                  Meta description ·{" "}
                  <State value={model.seo.metaDescriptionState} />
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  {model.seo.metaDescription ?? "Missing"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TraceItem label="Canonical" value={model.seo.canonicalState} />
                <TraceItem
                  label="Redirect evidence"
                  value={model.seo.redirectState}
                />
                <TraceItem
                  label="Indexability"
                  value={`${model.seo.indexabilityState} · draft is intentionally non-public`}
                />
                <TraceItem
                  label="H1 count"
                  value={`${model.seo.h1Count} · ${model.seo.h1State}`}
                />
                <TraceItem
                  label="Dev URL leakage"
                  value={model.seo.developmentUrlLeakState}
                />
              </div>
              <p className="text-xs text-zinc-500">{model.seo.detail}</p>
            </div>
          </section>
          <section
            className="border border-zinc-800 bg-zinc-900/45 p-5"
            aria-label="Research evidence"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-red-400">
              Research and Evidence
            </p>
            <div className="mt-4 divide-y divide-zinc-800">
              {model.evidence.map((item, index) => (
                <div key={`${item.source}-${index}`} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-white">
                      {item.source}
                    </p>
                    <span className="text-xs text-emerald-300">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Used for: {item.usedFor}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section
            className="border border-zinc-800 bg-zinc-900/45 p-5"
            aria-label="Generation QA"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-red-400">
              Generation QA
            </p>
            <div className="mt-4 divide-y divide-zinc-800">
              {model.qaChecks.map((check) => (
                <div key={check.label} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm capitalize text-zinc-300">
                      {check.label}
                    </p>
                    <State value={check.state} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{check.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section
        className="border border-zinc-800 bg-zinc-950/60 p-5"
        aria-label="Generation execution trace"
      >
        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
          Generation / Execution Trace
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TraceItem label="Job ID" value={model.trace.jobId} />
          <TraceItem
            label="External execution"
            value={model.trace.externalExecutionId}
          />
          <TraceItem label="Generation" value={model.trace.generationState} />
          <TraceItem
            label="Reconciliation"
            value={model.trace.reconciliationState}
          />
          <TraceItem
            label="WordPress object"
            value={
              model.trace.wordpressObjectId
                ? `#${model.trace.wordpressObjectId}`
                : null
            }
          />
          <TraceItem label="Attempt count" value={model.trace.attemptCount} />
          <TraceItem label="Last activity" value={model.trace.lastActivity} />
          <TraceItem
            label="Review decision"
            value="No durable campaign page-review decision exists"
          />
        </dl>
      </section>
    </div>
  );
}
