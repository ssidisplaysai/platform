import React from "react";
import Link from "next/link";
import type { GlwCampaignOperatorReadModel, OperatorImageState, OperatorStageState } from "./campaign-operator-read-model";

const stageTone: Record<OperatorStageState, string> = {
  COMPLETE: "border-emerald-800 bg-emerald-950/30 text-emerald-200",
  CURRENT: "border-red-600 bg-red-950/35 text-red-100",
  PARTIAL: "border-sky-800 bg-sky-950/25 text-sky-200",
  BLOCKED: "border-amber-800 bg-amber-950/25 text-amber-200",
  UPCOMING: "border-zinc-800 bg-zinc-950/50 text-zinc-500",
  NOT_REQUIRED: "border-zinc-800 bg-zinc-950/50 text-zinc-500",
};

const imageTone: Record<OperatorImageState, string> = {
  APPROVED: "text-emerald-300",
  READY: "text-sky-300",
  GENERATING: "text-sky-300",
  MISSING: "text-zinc-500",
  DEGRADED: "text-amber-300",
  NOT_WIRED: "text-zinc-500",
};

function label(value: string): string {
  return value.replaceAll("_", " ").toUpperCase();
}

function shortId(value: string | null): string {
  if (!value) return "Not created";
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function activity(value: string): string {
  return value.replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function reviewHref(model: GlwCampaignOperatorReadModel, jobId: string): string {
  return `/glw/pages/${encodeURIComponent(jobId)}/review?organizationId=${encodeURIComponent(model.campaign.organizationId)}&siteId=${encodeURIComponent(model.campaign.siteId)}`;
}

function Capability(props: { label: string; state: string; detail: string }) {
  const ready = props.state === "READY";
  const blocked = props.state === "BLOCKED" || props.state === "DRAFT_ONLY";
  return (
    <div className="min-w-0 border-l border-zinc-800 pl-3 first:border-l-0 first:pl-0">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{props.label}</p>
      <p className={`mt-1 text-sm font-semibold ${ready ? "text-emerald-300" : blocked ? "text-amber-300" : "text-zinc-300"}`}>{props.state.replaceAll("_", " ")}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{props.detail}</p>
    </div>
  );
}

function ImageStatus(props: { label: string; state: OperatorImageState; detail: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">{props.label}</p>
      <p className={`mt-0.5 text-xs font-semibold ${imageTone[props.state]}`} title={props.detail}>{props.state.replaceAll("_", " ")}</p>
    </div>
  );
}

export function GlwCampaignOperationsOverview({ model }: { model: GlwCampaignOperatorReadModel }) {
  const counts = [
    ["Reference Complete", model.counts.referenceComplete],
    ["Queued", model.counts.queued],
    ["Running", model.counts.running],
    ["Content Ready", model.counts.contentReady],
    ["Draft Ready", model.counts.draftReady],
    ["Failed", model.counts.failed],
  ] as const;

  return (
    <>
      <section className="border-y border-zinc-800 bg-zinc-950/50 px-5 py-5" aria-label="Campaign lifecycle">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-red-400">Current Stage</p>
            <h2 className="mt-2 text-2xl font-bold text-white">{model.currentStage}</h2>
            <p className="mt-1 text-sm text-zinc-400">Next: {model.nextStage}</p>
          </div>
          {model.canonicalAction.enabled ? (
            <Link href={model.canonicalAction.href} className="inline-flex min-h-11 items-center justify-center bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400">
              {model.canonicalAction.label}
            </Link>
          ) : (
            <div className="max-w-md border border-amber-800 bg-amber-950/25 px-4 py-3">
              <p className="text-sm font-semibold text-amber-200">{model.canonicalAction.label}</p>
              {model.canonicalAction.reason ? <p className="mt-1 text-xs leading-5 text-amber-300/80">{model.canonicalAction.reason}</p> : null}
            </div>
          )}
        </div>

        <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {model.lifecycle.map((stage) => (
            <li key={stage.key} className={`min-h-24 border p-3 ${stageTone[stage.state]}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{stage.state.replaceAll("_", " ")}</p>
              <p className="mt-2 text-sm font-semibold">{stage.label}</p>
              <p className="mt-1 text-xs leading-4 opacity-75">{stage.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-5 border-b border-zinc-800 bg-zinc-900/35 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Campaign capabilities">
        <Capability label="Release capability" {...model.capabilities.release} />
        <Capability label="MCP execution" {...model.capabilities.mcp} />
        <Capability label="Scheduler" {...model.capabilities.scheduler} />
        <Capability label="Publication policy" {...model.capabilities.publication} />
      </section>

      <section className="grid grid-cols-2 gap-px bg-zinc-800 sm:grid-cols-3 xl:grid-cols-6" aria-label="Campaign target counts">
        {counts.map(([name, value]) => (
          <div key={name} className="bg-zinc-950 px-4 py-4">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">{name}</p>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </section>

      <section id="target-workspace" className="border border-zinc-800 bg-zinc-950/60" aria-label="Campaign targets">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Target Activity</h2>
            <p className="mt-1 text-sm text-zinc-400">Exact campaign, job, execution, WordPress, and image evidence.</p>
          </div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">{model.targets.length} canonical targets</p>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Target</th><th className="px-4 py-3">Lifecycle State</th><th className="px-4 py-3">Job</th><th className="px-4 py-3">Execution</th><th className="px-4 py-3">WordPress</th><th className="px-4 py-3">Images</th><th className="px-4 py-3">Last Activity</th><th className="px-4 py-3">Issue</th>
              </tr>
            </thead>
            <tbody>
              {model.targets.map((target) => (
                <tr key={target.targetId} className="border-b border-zinc-900 align-top text-zinc-300 last:border-b-0">
                  <td className="px-4 py-4 font-semibold text-white">{target.identity}{target.jobId ? <Link href={reviewHref(model, target.jobId)} className="mt-2 block text-[11px] uppercase tracking-wider text-red-400 hover:text-red-300">Review generated page</Link> : null}</td>
                  <td className="px-4 py-4 text-xs font-semibold uppercase text-zinc-200">{label(target.lifecycleState)}</td>
                  <td className="px-4 py-4"><code className="text-xs text-zinc-300" title={target.jobId ?? undefined}>{shortId(target.jobId)}</code></td>
                  <td className="px-4 py-4"><p className="text-xs text-zinc-300">{target.executionState ? label(target.executionState) : "Not started"}</p>{target.executionId ? <code className="mt-1 block text-xs text-zinc-500" title={target.executionId}>{shortId(target.executionId)}</code> : null}</td>
                  <td className="px-4 py-4">{target.wordpressObjectId ? <><code className="text-xs text-white">#{target.wordpressObjectId}</code><p className="mt-1 text-xs uppercase text-emerald-300">{target.wordpressStatus ?? "verified"}</p></> : <span className="text-xs text-zinc-500">Not reached</span>}</td>
                  <td className="space-y-2 px-4 py-4"><ImageStatus label="Product Authority" {...target.productAuthorityImage} /><ImageStatus label="Contextual In-Use" {...target.contextualInUseImage} /></td>
                  <td className="px-4 py-4 text-xs leading-5 text-zinc-500">{activity(target.lastActivity)}</td>
                  <td className="max-w-64 px-4 py-4 text-xs leading-5 text-amber-300">{target.issue ?? "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-zinc-800 lg:hidden">
          {model.targets.map((target) => (
            <article key={target.targetId} className="space-y-4 px-4 py-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-white">{target.identity}</h3>{target.jobId ? <Link href={reviewHref(model, target.jobId)} className="mt-2 block text-[11px] uppercase tracking-wider text-red-400 hover:text-red-300">Review generated page</Link> : null}</div><span className="text-xs font-semibold uppercase text-zinc-300">{label(target.lifecycleState)}</span></div>
              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-xs">
                <dt className="text-zinc-500">Job</dt><dd><code title={target.jobId ?? undefined}>{shortId(target.jobId)}</code></dd>
                <dt className="text-zinc-500">Execution</dt><dd>{target.executionState ? `${label(target.executionState)} · ${shortId(target.executionId)}` : "Not started"}</dd>
                <dt className="text-zinc-500">WordPress</dt><dd>{target.wordpressObjectId ? `#${target.wordpressObjectId} · ${target.wordpressStatus ?? "verified"}` : "Not reached"}</dd>
                <dt className="text-zinc-500">Last activity</dt><dd>{activity(target.lastActivity)}</dd>
                <dt className="text-zinc-500">Issue</dt><dd className="text-amber-300">{target.issue ?? "None"}</dd>
              </dl>
              <div className="grid grid-cols-2 gap-3 border-t border-zinc-900 pt-3"><ImageStatus label="Product Authority" {...target.productAuthorityImage} /><ImageStatus label="Contextual In-Use" {...target.contextualInUseImage} /></div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
