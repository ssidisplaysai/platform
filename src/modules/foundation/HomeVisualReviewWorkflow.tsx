"use client";
import Link from "next/link";
import { useState } from "react";
import type { SiteVisualAssembly } from "./site-visual-assembly-repository";

type Continuation = {
  next: { action: string; label: string; detail: string; route: string };
  remaining: {
    expected: number;
    readyForOwnerReview: number;
    approved: number;
    blocked: number;
  };
  publication: { state: string; enabled: boolean };
};

export function HomeVisualReviewWorkflow({
  initialAssembly,
  initialContinuation,
  site,
}: {
  initialAssembly: SiteVisualAssembly;
  initialContinuation: Continuation;
  site: { organizationId: string; siteId: string; displayName: string };
}) {
  const [assembly, setAssembly] = useState(initialAssembly);
  const [continuation, setContinuation] = useState(initialContinuation);
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(confirm: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(site.siteId)}/site-build`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-gcp-roles": "ops_manager",
            "x-gcp-organization-id": site.organizationId,
            "x-gcp-site-id": site.siteId,
          },
          body: JSON.stringify({
            confirm,
            visualAssemblyId: assembly.assemblyId,
            instructions,
          }),
        },
      );
      const payload = (await response.json()) as {
        workspace?: {
          currentVisualAssembly?: SiteVisualAssembly;
          next: Continuation["next"];
          remainingVisualSummary: Continuation["remaining"];
          publication: Continuation["publication"];
        };
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Home design action failed.");
      if (payload.workspace?.currentVisualAssembly) {
        setAssembly(payload.workspace.currentVisualAssembly);
        setContinuation({
          next: payload.workspace.next,
          remaining: payload.workspace.remainingVisualSummary,
          publication: payload.workspace.publication,
        });
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Home design action failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5">
      <header className="border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs font-semibold uppercase text-red-400">
          Home Visual Assembly
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Review Designed Home
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              Actual Genesis-rendered preview of the exact visual assembly
              synchronized to WordPress draft {assembly.wordpressObjectId}.
            </p>
          </div>
          <span className="text-xs font-semibold text-amber-300">
            {assembly.status.replaceAll("_", " ")}
          </span>
        </div>
        <dl className="mt-4 grid gap-3 text-xs text-zinc-400 sm:grid-cols-4">
          <div>
            <dt>Design system</dt>
            <dd className="text-zinc-200">{assembly.designSystemVersion}</dd>
          </div>
          <div>
            <dt>Home revision</dt>
            <dd className="text-zinc-200">{assembly.pageRevisionId}</dd>
          </div>
          <div>
            <dt>WordPress media</dt>
            <dd className="text-zinc-200">{assembly.wordpressMediaId}</dd>
          </div>
          <div>
            <dt>WordPress status</dt>
            <dd className="text-zinc-200">DRAFT</dd>
          </div>
        </dl>
      </header>
      {assembly.status === "APPROVED" ? (
        <section className="border-l-4 border-emerald-500 bg-emerald-950/20 p-6">
          <p className="text-xs font-semibold uppercase text-emerald-300">
            Home Design Approved
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            The approved Home now defines this site&apos;s visual system.
          </h2>
          <p className="mt-2 text-sm text-zinc-300">
            {continuation.remaining.readyForOwnerReview > 0
              ? `${continuation.remaining.readyForOwnerReview} additional page designs are ready for governed owner review.`
              : `All ${continuation.remaining.expected} additional page designs are approved and ready for the next governed stage.`}
          </p>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <dt className="text-zinc-500">Home design</dt>
              <dd className="font-semibold text-emerald-300">APPROVED</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Remaining designs</dt>
              <dd className="font-semibold text-white">
                {continuation.remaining.expected}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Ready for review</dt>
              <dd className="font-semibold text-amber-300">
                {continuation.remaining.readyForOwnerReview}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Approved</dt>
              <dd className="font-semibold text-white">
                {continuation.remaining.approved}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Blocked</dt>
              <dd className="font-semibold text-white">
                {continuation.remaining.blocked}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Publication</dt>
              <dd className="font-semibold text-zinc-200">
                {continuation.publication.state.toUpperCase()}
              </dd>
            </div>
          </dl>
          <Link
            href={continuation.next.route}
            className="mt-5 inline-block bg-red-600 px-5 py-3 text-sm font-semibold text-white"
          >
            {continuation.next.label}
          </Link>
        </section>
      ) : (
        <section className="border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="font-semibold text-white">Owner design decision</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={busy || assembly.status !== "READY_FOR_OWNER_REVIEW"}
              onClick={() => act("APPROVE_HOME_VISUAL")}
              className="bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              APPROVE HOME DESIGN
            </button>
            <button
              disabled={busy || assembly.status !== "READY_FOR_OWNER_REVIEW"}
              onClick={() => act("REQUEST_HOME_VISUAL_CHANGES")}
              className="border border-zinc-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              REQUEST DESIGN CHANGES
            </button>
            <button
              disabled={busy || !instructions.trim()}
              onClick={() => act("REASSEMBLE_HOME_VISUAL")}
              className="border border-red-800 px-4 py-3 text-sm font-semibold text-red-200 disabled:opacity-40"
            >
              REGENERATE / REASSEMBLE WITH INSTRUCTIONS
            </button>
          </div>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={3}
            placeholder="Describe visual changes without changing approved Home claims"
            className="mt-3 w-full border border-zinc-700 bg-zinc-900 p-3 text-sm text-white"
          />
          {error ? (
            <p role="alert" className="mt-3 text-red-300">
              {error}
            </p>
          ) : null}
        </section>
      )}
      <div className="border border-zinc-800 bg-white">
        <iframe
          title="Designed Home preview"
          srcDoc={assembly.contentHtml}
          className="h-[900px] w-full"
        />
      </div>
    </section>
  );
}
