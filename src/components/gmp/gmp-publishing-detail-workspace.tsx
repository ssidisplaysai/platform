"use client";

import React from "react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { GmpDestinationHealth } from "./gmp-destination-health";
import { GmpDestinationCapabilities } from "./gmp-destination-capabilities";
import { GmpReleaseDependencyPlan } from "./gmp-release-dependency-plan";
import { GmpReleaseProgress } from "./gmp-release-progress";
import { GmpPublicationTimeline } from "./gmp-publication-timeline";
import { GmpPublicationRetryDialog } from "./gmp-publication-retry-dialog";
import { GmpPublicationRollbackDialog } from "./gmp-publication-rollback-dialog";
import { GmpVerificationDetail } from "./gmp-verification-detail";
import { GmpReconciliationDifferences } from "./gmp-reconciliation-differences";
import { GmpMediaDeliveryStatus } from "./gmp-media-delivery-status";
import { GmpWordpressTransportStatus } from "./gmp-wordpress-transport-status";

type DetailMode = "destination" | "release" | "publication" | "package";

async function getJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { credentials: "include", cache: "no-store" }).catch(() => null);
  if (!response?.ok) return null;
  return response.json() as Promise<T>;
}

export function GmpPublishingDetailWorkspace({
  mode,
  projectId,
  destinationId,
  releaseId,
  publicationId,
  packageId,
  canForceRepublish,
  permissions,
}: {
  mode: DetailMode;
  projectId: string;
  destinationId?: string;
  releaseId?: string;
  publicationId?: string;
  packageId?: string;
  canForceRepublish?: boolean;
  permissions?: {
    canManageDestinations?: boolean;
    canValidateDestinations?: boolean;
    canApprovePackage?: boolean;
    canApproveRelease?: boolean;
    canRetryRelease?: boolean;
    canRetryPublication?: boolean;
    canExecuteRollback?: boolean;
    canReconcilePublication?: boolean;
  };
}) {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);

    if (mode === "destination" && destinationId) {
      const detail = await getJson<Record<string, unknown>>(`/api/gmp/publishing/destinations/${destinationId}`);
      if (!detail) {
        setError("Unable to load destination detail.");
        return;
      }
      setPayload(detail);
      return;
    }

    if (mode === "release" && releaseId) {
      const [release, plan, progress] = await Promise.all([
        getJson<Record<string, unknown>>(`/api/gmp/publishing/releases/${releaseId}`),
        getJson<Record<string, unknown>>(`/api/gmp/publishing/releases/${releaseId}/dependency-plan`),
        getJson<Record<string, unknown>>(`/api/gmp/publishing/releases/${releaseId}/progress`),
      ]);
      setPayload({ release, plan: plan?.plan, progress: progress?.progress });
      return;
    }

    if (mode === "publication" && publicationId) {
      const [publication, history, reconcile] = await Promise.all([
        getJson<Record<string, unknown>>(`/api/gmp/publishing/publications/${publicationId}`),
        getJson<Record<string, unknown>>(`/api/gmp/publishing/publications/${publicationId}/history`),
        getJson<Record<string, unknown>>(`/api/gmp/publishing/publications/${publicationId}/reconcile`),
      ]);
      setPayload({ publication, timeline: history?.timeline, reconciliationDetail: reconcile });
      return;
    }

    if (mode === "package" && packageId) {
      const detail = await getJson<Record<string, unknown>>(`/api/gmp/publishing/packages/${packageId}`);
      setPayload({ packageDetail: detail });
      return;
    }
  }, [mode, destinationId, releaseId, publicationId, packageId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function runAction(path: string, body?: Record<string, unknown>) {
    setMessage(null);
    setError(null);
    const response = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);

    if (!response?.ok) {
      setError("Action request failed or unauthorized.");
      return;
    }

    setMessage("Action completed.");
    await load();
  }

  async function onPatchDestination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!destinationId) return;

    const form = new FormData(event.currentTarget);
    const patch = {
      name: String(form.get("name") ?? ""),
      baseUrl: String(form.get("baseUrl") ?? ""),
      environment: String(form.get("environment") ?? "production"),
    };

    const response = await fetch(`/api/gmp/publishing/destinations/${destinationId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Destination configuration update failed.");
      return;
    }

    setMessage("Destination configuration updated.");
    await load();
  }

  const detail = payload ?? {};
  const canManageDestinations = Boolean(permissions?.canManageDestinations);
  const canValidateDestinations = Boolean(permissions?.canValidateDestinations);
  const canApprovePackage = Boolean(permissions?.canApprovePackage);
  const canApproveRelease = Boolean(permissions?.canApproveRelease);
  const canRetryRelease = Boolean(permissions?.canRetryRelease);
  const canRetryPublication = Boolean(permissions?.canRetryPublication);
  const canExecuteRollback = Boolean(permissions?.canExecuteRollback);
  const canReconcilePublication = Boolean(permissions?.canReconcilePublication);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Publishing Operator</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{mode[0].toUpperCase() + mode.slice(1)} Detail</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link href={`/glw/projects/${projectId}/publishing`} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-100">Overview</Link>
          <Link href={`/glw/projects/${projectId}/publishing/destinations`} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-100">Destinations</Link>
          <Link href={`/glw/projects/${projectId}/publishing/releases`} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-100">Releases</Link>
          <Link href={`/glw/projects/${projectId}/publishing/publications`} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-100">Publications</Link>
          <Link href={`/glw/projects/${projectId}/publishing/packages`} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-100">Packages</Link>
        </div>
      </section>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

      {mode === "destination" ? (
        <>
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-lg font-semibold text-white">Destination Summary</h2>
            <p className="mt-2 text-sm text-zinc-300">{String((detail.destination as Record<string, unknown> | undefined)?.name ?? "unknown")}</p>
            <p className="text-sm text-zinc-400">Type: {String((detail.destination as Record<string, unknown> | undefined)?.destinationType ?? "unknown")} • Base URL: {String((detail.destination as Record<string, unknown> | undefined)?.baseUrl ?? "unknown")}</p>
            <p className="text-sm text-zinc-400">Environment: {String((detail.destination as Record<string, unknown> | undefined)?.environment ?? "unknown")} • Connection: {String((detail.destination as Record<string, unknown> | undefined)?.connectionStatus ?? "unknown")}</p>
            <p className="text-sm text-zinc-400">Credential reference status: {String(detail.credentialReferenceStatus ?? "unknown")} • validation: {String(detail.credentialValidationStatus ?? "unknown")}</p>
            <p className="text-sm text-zinc-400">Remote API availability: {String(detail.remoteApiAvailability ?? "unknown")}</p>
            <p className="text-sm text-zinc-400">Media: {String(detail.mediaCapability ?? "unknown")} • SEO: {String(detail.seoCapability ?? "unknown")} • Scheduling: {String(detail.schedulingCapability ?? "unknown")}</p>
            <p className="text-sm text-zinc-400">Rollback: {String(detail.rollbackCapability ?? "unknown")} • Verification: {String(detail.verificationCapability ?? "unknown")}</p>
            <p className="text-sm text-zinc-400">Recent verification mismatches: {String(detail.recentVerificationMismatches ?? 0)} • Open reconciliation issues: {String(detail.openReconciliationIssues ?? 0)}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {canValidateDestinations ? <button type="button" onClick={() => void runAction(`/api/gmp/publishing/destinations/${destinationId}/validate`)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200">Validate Connection</button> : null}
              <button type="button" onClick={() => void load()} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200">Refresh Capabilities</button>
              <button type="button" onClick={() => void load()} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200">Refresh Health</button>
              {canValidateDestinations ? <button type="button" onClick={() => void runAction(`/api/gmp/publishing/destinations/${destinationId}/test-read`)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200">Test Read Access</button> : null}
              {canManageDestinations ? <button type="button" onClick={() => void runAction(`/api/gmp/publishing/destinations/${destinationId}/test-write`)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200">Test Write Capability</button> : null}
              {canManageDestinations ? <button type="button" onClick={() => void runAction(`/api/gmp/publishing/destinations/${destinationId}/credentials/invalidate`)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200">Invalidate Credential Cache</button> : null}
            </div>

            {canManageDestinations ? (
              <form onSubmit={(event) => void onPatchDestination(event)} className="mt-4 grid gap-2 sm:grid-cols-3">
                <input name="name" placeholder="Name" defaultValue={String((detail.destination as Record<string, unknown> | undefined)?.name ?? "")} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                <input name="baseUrl" placeholder="Base URL" defaultValue={String((detail.destination as Record<string, unknown> | undefined)?.baseUrl ?? "")} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                <input name="environment" placeholder="Environment" defaultValue={String((detail.destination as Record<string, unknown> | undefined)?.environment ?? "production")} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                <button type="submit" className="justify-self-start rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Edit Non-Secret Configuration</button>
              </form>
            ) : null}
          </section>

          <GmpDestinationHealth health={detail.health as Record<string, unknown> | undefined as never} />
          <GmpDestinationCapabilities capabilities={detail.capabilityProfile as Record<string, boolean> | undefined} />
          <GmpWordpressTransportStatus detail={detail} />

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-lg font-semibold text-white">Recent Attempts</h2>
            {Array.isArray(detail.recentAttempts) && detail.recentAttempts.length > 0 ? (detail.recentAttempts as Array<Record<string, unknown>>).map((entry) => (
              <p key={String(entry.publicationAttemptId)} className="text-sm text-zinc-300">{String(entry.publicationAttemptId)} • {String(entry.status)} • {String(entry.failureCategory ?? "none")}</p>
            )) : <p className="text-sm text-zinc-400">No attempts available.</p>}
          </section>
        </>
      ) : null}

      {mode === "release" ? (
        <>
          <GmpReleaseProgress progress={detail.progress as never} />
          <GmpReleaseDependencyPlan plan={detail.plan as never} />
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-wrap gap-2">
              {canRetryRelease ? <button type="button" onClick={() => void runAction(`/api/gmp/publishing/releases/${releaseId}/retry`)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200">Retry Failed Release Items</button> : null}
              {canApproveRelease ? <button type="button" onClick={() => void runAction(`/api/gmp/publishing/releases/${releaseId}/approve`)} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs text-emerald-200">Approve Release</button> : null}
            </div>
          </section>
        </>
      ) : null}

      {mode === "publication" ? (
        <>
          <GmpPublicationTimeline entries={detail.timeline as never} />
          <GmpVerificationDetail verification={(detail.publication as Record<string, unknown> | undefined)?.verification as never} />
          <GmpReconciliationDifferences reconciliation={(detail.reconciliationDetail as Record<string, unknown> | undefined)?.reconciliation as never} verification={(detail.reconciliationDetail as Record<string, unknown> | undefined)?.verification as never} canResolve={canReconcilePublication} canForceRepublish={Boolean(canForceRepublish)} />

          <div className="grid gap-4 xl:grid-cols-2">
            {canRetryPublication ? (
              <GmpPublicationRetryDialog
                publicationId={publicationId ?? ""}
                prior={{
                  attemptNumber: 1,
                  failureCategory: "UNKNOWN",
                  failureMessage: "Review last attempt in timeline.",
                  retryable: true,
                }}
                onRetried={load}
              />
            ) : null}

            {canExecuteRollback ? (
              <GmpPublicationRollbackDialog
                publicationId={publicationId ?? ""}
                targets={(() => {
                  const publication = (detail.publication as Record<string, unknown> | undefined)?.publication as Record<string, unknown> | undefined;
                  if (!publication) return [];
                  return [{
                    publicationRecordId: String(publication.publicationRecordId ?? ""),
                    externalObjectId: String(publication.externalObjectId ?? ""),
                    externalRevisionId: String(publication.externalRevisionId ?? ""),
                    verificationStatus: String(publication.verificationStatus ?? "PENDING"),
                    publishedAt: String(publication.publishedAt ?? ""),
                  }];
                })()}
                rollbackCapable={Boolean((detail.publication as Record<string, unknown> | undefined)?.publication)}
                onRolledBack={load}
              />
            ) : null}
          </div>
        </>
      ) : null}

      {mode === "package" ? (
        <>
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-lg font-semibold text-white">Package Detail</h2>
            <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify((detail.packageDetail as Record<string, unknown> | undefined)?.package ?? {}, null, 2)}</pre>
            {canApprovePackage ? (
              <div className="mt-3">
                <button type="button" onClick={() => void runAction(`/api/gmp/publishing/packages/${packageId}/approve`)} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs text-emerald-200">Approve Package</button>
              </div>
            ) : null}
          </section>
          <GmpMediaDeliveryStatus mediaManifest={(detail.packageDetail as Record<string, unknown> | undefined)?.manifest as Record<string, unknown> | undefined} />
        </>
      ) : null}
    </div>
  );
}
