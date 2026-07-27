"use client";

import React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AsyncState =
  | { kind: "idle" }
  | { kind: "running"; label: string }
  | { kind: "success"; label: string }
  | { kind: "error"; label: string; detail: string };

function useAsyncState() {
  const [state, setState] = useState<AsyncState>({ kind: "idle" });

  return {
    state,
    start(label: string) {
      setState({ kind: "running", label });
    },
    success(label: string) {
      setState({ kind: "success", label });
    },
    failure(label: string, detail: string) {
      setState({ kind: "error", label, detail });
    },
  };
}

async function parseSafeError(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  if (!body) {
    return `Request failed with status ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    // Keep generic response message.
  }

  return `Request failed with status ${response.status}.`;
}

export function GmpAnalyticsSourceOperatorControls(props: {
  workspaceId: string;
  projectId: string;
  sourceId: string;
  canValidateSource: boolean;
  canRunCollection: boolean;
  canViewCapabilities: boolean;
  canViewHealth: boolean;
}) {
  const router = useRouter();
  const asyncState = useAsyncState();

  const disabled = asyncState.state.kind === "running";

  const capabilityHref = useMemo(
    () => `/api/gmp/analytics/sources/${props.sourceId}/capabilities?workspaceId=${encodeURIComponent(props.workspaceId)}`,
    [props.sourceId, props.workspaceId],
  );
  const healthHref = useMemo(
    () => `/api/gmp/analytics/sources/${props.sourceId}/health?workspaceId=${encodeURIComponent(props.workspaceId)}`,
    [props.sourceId, props.workspaceId],
  );

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">Operator Controls</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {props.canValidateSource ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-100 disabled:opacity-60"
            onClick={async () => {
              asyncState.start("Validating source");
              const response = await fetch(`/api/gmp/analytics/sources/${props.sourceId}/validate?workspaceId=${encodeURIComponent(props.workspaceId)}`, {
                method: "POST",
              });
              if (!response.ok) {
                asyncState.failure("Validate source", await parseSafeError(response));
                return;
              }
              asyncState.success("Source validated");
              router.refresh();
            }}
          >
            Validate Source
          </button>
        ) : (
          <span className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-500">Validate Source (unauthorized)</span>
        )}

        {props.canRunCollection ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-md border border-cyan-700 bg-cyan-900/30 px-3 py-2 text-xs text-cyan-100 disabled:opacity-60"
            onClick={async () => {
              asyncState.start("Requesting collection");
              const response = await fetch(`/api/gmp/analytics/collections?workspaceId=${encodeURIComponent(props.workspaceId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  projectId: props.projectId,
                  analyticsSourceId: props.sourceId,
                  collectionMode: "MANUAL",
                  requestedMetrics: [],
                  requestedDimensions: [],
                }),
              });
              if (!response.ok) {
                asyncState.failure("Run collection", await parseSafeError(response));
                return;
              }
              asyncState.success("Collection requested");
              router.refresh();
            }}
          >
            Run Collection
          </button>
        ) : (
          <span className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-500">Run Collection (unauthorized)</span>
        )}

        {props.canViewCapabilities ? (
          <a href={capabilityHref} className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-100">
            View Detected Capabilities
          </a>
        ) : (
          <span className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-500">View Capabilities (unauthorized)</span>
        )}

        {props.canViewHealth ? (
          <a href={healthHref} className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-100">
            View Source Health
          </a>
        ) : (
          <span className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-500">View Source Health (unauthorized)</span>
        )}
      </div>

      {asyncState.state.kind === "error" ? (
        <p className="mt-3 rounded-md border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
          {asyncState.state.label}: {asyncState.state.detail}
        </p>
      ) : null}

      {asyncState.state.kind === "success" ? (
        <p className="mt-3 rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
          {asyncState.state.label}
        </p>
      ) : null}
    </section>
  );
}

export function GmpAnalyticsCollectionOperatorControls(props: {
  workspaceId: string;
  collectionId: string;
  canRetryCollection: boolean;
  retryEligible: boolean;
  retryReason?: string;
}) {
  const router = useRouter();
  const asyncState = useAsyncState();

  const disabled = asyncState.state.kind === "running" || !props.retryEligible || !props.canRetryCollection;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">Collection Actions</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          className="rounded-md border border-cyan-700 bg-cyan-900/30 px-3 py-2 text-xs text-cyan-100 disabled:opacity-60"
          onClick={async () => {
            asyncState.start("Retrying collection");
            const response = await fetch(`/api/gmp/analytics/collections/${props.collectionId}/retry?workspaceId=${encodeURIComponent(props.workspaceId)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "resume" }),
            });
            if (!response.ok) {
              asyncState.failure("Retry collection", await parseSafeError(response));
              return;
            }
            asyncState.success("Retry collection created");
            router.refresh();
          }}
        >
          Retry Collection
        </button>

        <a
          href={`/api/gmp/analytics/collections/${props.collectionId}/timeline?workspaceId=${encodeURIComponent(props.workspaceId)}&limit=100`}
          className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-100"
        >
          View Timeline API
        </a>
      </div>

      {!props.canRetryCollection ? (
        <p className="mt-3 text-xs text-zinc-500">Retry control hidden by server authorization policy.</p>
      ) : null}
      {props.canRetryCollection && !props.retryEligible ? (
        <p className="mt-3 text-xs text-zinc-400">Retry not eligible: {props.retryReason ?? "Collection state is not retryable."}</p>
      ) : null}

      {asyncState.state.kind === "error" ? (
        <p className="mt-3 rounded-md border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
          {asyncState.state.label}: {asyncState.state.detail}
        </p>
      ) : null}

      {asyncState.state.kind === "success" ? (
        <p className="mt-3 rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
          {asyncState.state.label}
        </p>
      ) : null}
    </section>
  );
}
