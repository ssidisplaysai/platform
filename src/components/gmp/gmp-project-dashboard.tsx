"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GmpArchitectureSummary } from "@/components/gmp/gmp-architecture-summary";
import { type GmpPageHealthReport } from "@/lib/gmp/page-health-contract";

type DashboardPayload = {
  project: {
    projectId: string;
    name: string;
    slug: string;
    description?: string;
    status: string;
    lifecycleState: string;
    organization?: string;
    defaultLanguage: string;
    defaultLocale: string;
    timezone: string;
  };
  sites: Array<{
    siteId: string;
    displayName: string;
    primaryDomain: string;
    environment: string;
    publishingPlatform: string;
    connectionStatus: string;
    publishingStatus: string;
  }>;
  brandProfile: {
    companyName: string;
    tagline?: string;
    mission?: string;
    brandVoice?: string;
    writingStyle?: string;
    primaryAudience?: string;
    secondaryAudience?: string;
    primaryColor?: string;
    secondaryColor?: string;
  } | null;
  publishingConnections: Array<{
    connectionId: string;
    siteId: string;
    provider: string;
    environment: string;
    connectionStatus: string;
    publishingStatus: string;
  }>;
  executionSummary: {
    running: number;
    completed: number;
    failed: number;
  };
  runtimeHealth: {
    status: string;
    queueLatencyMs: number;
    workerHeartbeatLagMs: number;
  };
  queueStatus: {
    depth: number;
    state: string;
  };
  workerHealth: Array<{ workerId: string; health: string; currentWorkload: number; maxCapacity: number }>;
  recentExecutions: Array<{ executionId: string; status: string; createdAt?: string; timing: { createdAt: string } }>;
  knowledgeReadiness: {
    workspaceStatus: string;
    completenessScore: number;
    approvedRecordCount: number;
    draftRecordCount: number;
    conflictCount: number;
    recordsRequiringReview: number;
    sourceCount: number;
    lastApprovedVersion: number;
    futureBusinessGenomeConnectionStatus: string;
  };
  contentStatus: {
    state: string;
    summary: string;
    pagesEligibleForGeneration: number;
    pagesBlockedFromGeneration: number;
    draftsGenerating: number;
    draftsGenerated: number;
    draftsInReview: number;
    draftsWithChangesRequested: number;
    approvedDrafts: number;
    failedGenerationRequests: number;
    sectionsGenerated: number;
    sectionsFailed: number;
    sectionsAwaitingReview: number;
    averageEditorialScore: number;
    claimValidationFailures: number;
    restrictionViolations: number;
    recentGenerationExecutions: Array<{ executionId: string; status: string; createdAt?: string }>;
  };
  publishingGovernance?: {
    packagesDraft: number;
    packagesAwaitingValidation: number;
    packagesAwaitingApproval: number;
    packagesApproved: number;
    releasesScheduled: number;
    releasesRunning: number;
    releasesFailed: number;
    pagesPublished: number;
    pagesAwaitingVerification: number;
    verificationMismatches: number;
    remoteDriftDetected: number;
    destinationFailures: number;
    recentPublications: Array<{ publicationRecordId: string; externalUrl: string; publishedStatus: string; createdAt: string }>;
    recentRollbacks: Array<{ releaseId: string; status: string; createdAt: string }>;
    recentPublishingExecutions: Array<{ executionId: string; status: string; createdAt?: string }>;
  };
  seoStatus: { state: string; summary: string };
  pageArchitecture?: GmpPageHealthReport;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function GmpProjectDashboard({ projectId }: { projectId: string }) {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchDashboard(): Promise<DashboardPayload | null> {
    const response = await fetch(`/api/gmp/projects/${projectId}/dashboard`, {
      credentials: "include",
      cache: "no-store",
    }).catch(() => null);

    if (!response || !response.ok) {
      return null;
    }

    return response.json() as Promise<DashboardPayload>;
  }

  const load = async () => {
    const next = await fetchDashboard();
    if (!next) {
      setError("Unable to load project dashboard.");
      return;
    }

    setPayload(next);
    setError(null);
  };

  useEffect(() => {
    let active = true;

    const poll = async () => {
      const response = await fetch(`/api/gmp/projects/${projectId}/dashboard`, {
        credentials: "include",
        cache: "no-store",
      }).catch(() => null);

      if (!active) {
        return;
      }

      if (!response || !response.ok) {
        setError("Unable to load project dashboard.");
        return;
      }

      const next = await response.json() as DashboardPayload;
      if (!active) {
        return;
      }

      setPayload(next);
      setError(null);
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 7000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [projectId]);

  const siteOptions = useMemo(() => payload?.sites ?? [], [payload]);

  async function onUpdateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/gmp/projects/${projectId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        organization: form.get("organization"),
        status: form.get("status"),
        lifecycleState: form.get("lifecycleState"),
        defaultLanguage: form.get("defaultLanguage"),
        defaultLocale: form.get("defaultLocale"),
        timezone: form.get("timezone"),
      }),
    }).catch(() => null);

    if (!response || !response.ok) {
      setError("Unable to update project settings.");
      return;
    }

    await load();
  }

  async function onCreateSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/gmp/projects/${projectId}/sites`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        primaryDomain: form.get("primaryDomain"),
        environment: form.get("environment"),
        publishingPlatform: form.get("publishingPlatform"),
        authenticationMethod: form.get("authenticationMethod"),
      }),
    }).catch(() => null);

    if (!response || !response.ok) {
      setError("Unable to create site.");
      return;
    }

    event.currentTarget.reset();
    await load();
  }

  async function onSaveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const response = await fetch(`/api/gmp/projects/${projectId}/brand-profile`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: form.get("companyName"),
        tagline: form.get("tagline"),
        mission: form.get("mission"),
        brandVoice: form.get("brandVoice"),
        writingStyle: form.get("writingStyle"),
        primaryAudience: form.get("primaryAudience"),
        secondaryAudience: form.get("secondaryAudience"),
        primaryColor: form.get("primaryColor"),
        secondaryColor: form.get("secondaryColor"),
      }),
    }).catch(() => null);

    if (!response || !response.ok) {
      setError("Unable to save brand profile.");
      return;
    }

    await load();
  }

  async function onCreateConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const siteId = String(form.get("siteId") ?? "");
    if (!siteId) {
      setError("Select a site first.");
      return;
    }

    const response = await fetch(`/api/gmp/sites/${siteId}/connections`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: form.get("provider"),
        environment: form.get("environment"),
        authenticationMethod: form.get("authenticationMethod"),
        publishingCapabilities: String(form.get("publishingCapabilities") ?? "draft,publish").split(",").map((entry) => entry.trim()).filter(Boolean),
      }),
    }).catch(() => null);

    if (!response || !response.ok) {
      setError("Unable to create publishing connection.");
      return;
    }

    event.currentTarget.reset();
    await load();
  }

  if (!payload) {
    return <div className="mx-auto w-full max-w-7xl px-4 text-sm text-zinc-400 sm:px-6 lg:px-8">Loading project dashboard...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Project Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{payload.project.name}</h1>
        <p className="mt-2 text-sm text-zinc-400">{payload.project.description ?? "No project description yet."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/glw/projects/${projectId}/knowledge`} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-950">Knowledge Workspace</Link>
          <Link href={`/glw/projects/${projectId}/pages`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Page Workspace</Link>
          <Link href={`/glw/projects/${projectId}/publishing`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Publishing Workspace</Link>
          <Link href={`/glw/projects/${projectId}/analytics`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Analytics Workspace</Link>
          <Link href={`/glw/projects/${projectId}/knowledge/records`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Records</Link>
          <Link href={`/glw/projects/${projectId}/knowledge/review`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Review Queue</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Running Executions</p><p className="mt-2 text-2xl text-white">{payload.executionSummary.running}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Completed Executions</p><p className="mt-2 text-2xl text-white">{payload.executionSummary.completed}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Failed Executions</p><p className="mt-2 text-2xl text-white">{payload.executionSummary.failed}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Queue</p><p className="mt-2 text-2xl text-white">{payload.queueStatus.depth}</p><p className="text-xs text-zinc-500">{payload.queueStatus.state}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Runtime Health</p><p className="mt-2 text-2xl text-white">{payload.runtimeHealth.status}</p></article>
      </section>

      {payload.pageArchitecture ? (
        <GmpArchitectureSummary
          pagesReady={payload.pageArchitecture.pagesReady}
          pagesBlocked={payload.pageArchitecture.pagesBlocked}
          missingBriefs={payload.pageArchitecture.missingBriefs}
          missingPlans={payload.pageArchitecture.missingPlans}
          missingSections={payload.pageArchitecture.missingSections}
          averageReadiness={payload.pageArchitecture.averageReadiness}
          relationshipHealth={payload.pageArchitecture.relationshipHealth}
          linkHealth={payload.pageArchitecture.linkHealth}
          orphanPages={payload.pageArchitecture.orphanPages}
          duplicateCanonicals={payload.pageArchitecture.duplicateCanonicals}
          latestExecutions={payload.pageArchitecture.latestGopExecutions}
        />
      ) : null}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Content Generation</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 text-sm text-zinc-300">
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Eligible Pages</p><p className="mt-1 text-lg text-white">{payload.contentStatus.pagesEligibleForGeneration}</p></article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Blocked Pages</p><p className="mt-1 text-lg text-white">{payload.contentStatus.pagesBlockedFromGeneration}</p></article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Drafts Generating</p><p className="mt-1 text-lg text-white">{payload.contentStatus.draftsGenerating}</p></article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Drafts Generated</p><p className="mt-1 text-lg text-white">{payload.contentStatus.draftsGenerated}</p></article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-500">In Review</p><p className="mt-1 text-lg text-white">{payload.contentStatus.draftsInReview}</p></article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Approved Drafts</p><p className="mt-1 text-lg text-white">{payload.contentStatus.approvedDrafts}</p></article>
          </div>
          <p className="mt-4 text-sm text-zinc-400">{payload.contentStatus.summary}</p>
          <div className="mt-4 space-y-2">
            {payload.contentStatus.recentGenerationExecutions.map((execution) => (
              <div key={execution.executionId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                <p className="text-sm font-medium text-white">{execution.executionId}</p>
                <p className="text-xs text-zinc-400">{execution.status}{execution.createdAt ? ` • ${formatDate(execution.createdAt)}` : ""}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Publishing Governance</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 text-sm text-zinc-300">
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Packages Draft</p><p className="mt-1 text-lg text-white">{payload.publishingGovernance?.packagesDraft ?? 0}</p></article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Awaiting Approval</p><p className="mt-1 text-lg text-white">{payload.publishingGovernance?.packagesAwaitingApproval ?? 0}</p></article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Approved Packages</p><p className="mt-1 text-lg text-white">{payload.publishingGovernance?.packagesApproved ?? 0}</p></article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Releases Scheduled</p><p className="mt-1 text-lg text-white">{payload.publishingGovernance?.releasesScheduled ?? 0}</p></article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Releases Running</p><p className="mt-1 text-lg text-white">{payload.publishingGovernance?.releasesRunning ?? 0}</p></article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Published Pages</p><p className="mt-1 text-lg text-white">{payload.publishingGovernance?.pagesPublished ?? 0}</p></article>
          </div>
          <div className="mt-4 space-y-2">
            {(payload.publishingGovernance?.recentPublishingExecutions ?? []).map((execution) => (
              <div key={execution.executionId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                <p className="text-sm font-medium text-white">{execution.executionId}</p>
                <p className="text-xs text-zinc-400">{execution.status}{execution.createdAt ? ` • ${formatDate(execution.createdAt)}` : ""}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Project Settings</h2>
          <form className="mt-4 space-y-3" onSubmit={(event) => void onUpdateProject(event)}>
            <input name="name" defaultValue={payload.project.name} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <input name="organization" defaultValue={payload.project.organization ?? ""} placeholder="Organization" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <textarea name="description" defaultValue={payload.project.description ?? ""} rows={3} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="status" defaultValue={payload.project.status} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="lifecycleState" defaultValue={payload.project.lifecycleState} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input name="defaultLanguage" defaultValue={payload.project.defaultLanguage} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="defaultLocale" defaultValue={payload.project.defaultLocale} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="timezone" defaultValue={payload.project.timezone} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            </div>
            <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Save Project Settings</button>
          </form>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Brand Profile</h2>
          <form className="mt-4 space-y-3" onSubmit={(event) => void onSaveBrand(event)}>
            <input name="companyName" required defaultValue={payload.brandProfile?.companyName ?? payload.project.name} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <input name="tagline" defaultValue={payload.brandProfile?.tagline ?? ""} placeholder="Tagline" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <textarea name="mission" defaultValue={payload.brandProfile?.mission ?? ""} rows={2} placeholder="Mission" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <textarea name="brandVoice" defaultValue={payload.brandProfile?.brandVoice ?? ""} rows={2} placeholder="Brand voice" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <textarea name="writingStyle" defaultValue={payload.brandProfile?.writingStyle ?? ""} rows={2} placeholder="Writing style" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="primaryAudience" defaultValue={payload.brandProfile?.primaryAudience ?? ""} placeholder="Primary audience" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="secondaryAudience" defaultValue={payload.brandProfile?.secondaryAudience ?? ""} placeholder="Secondary audience" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="primaryColor" defaultValue={payload.brandProfile?.primaryColor ?? ""} placeholder="Primary color" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="secondaryColor" defaultValue={payload.brandProfile?.secondaryColor ?? ""} placeholder="Secondary color" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            </div>
            <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Save Brand Profile</button>
          </form>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Sites</h2>
          <div className="mt-3 space-y-2">
            {payload.sites.length === 0 ? <p className="text-sm text-zinc-400">No sites configured yet.</p> : payload.sites.map((site) => (
              <div key={site.siteId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                <p className="text-sm font-medium text-white">{site.displayName}</p>
                <p className="text-xs text-zinc-400">{site.primaryDomain} • {site.environment} • {site.publishingPlatform} • {site.connectionStatus}</p>
              </div>
            ))}
          </div>

          <form className="mt-4 grid gap-2" onSubmit={(event) => void onCreateSite(event)}>
            <input name="displayName" required placeholder="Site display name" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <input name="primaryDomain" required placeholder="Primary domain" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <div className="grid gap-2 sm:grid-cols-3">
              <select name="environment" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="development">development</option>
                <option value="staging">staging</option>
                <option value="production">production</option>
              </select>
              <select name="publishingPlatform" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="wordpress">wordpress</option>
                <option value="shopify">shopify</option>
                <option value="webflow">webflow</option>
                <option value="contentful">contentful</option>
                <option value="headless_cms">headless_cms</option>
                <option value="custom_api">custom_api</option>
              </select>
              <select name="authenticationMethod" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="token">token</option>
                <option value="oauth2">oauth2</option>
                <option value="api_key">api_key</option>
                <option value="basic">basic</option>
                <option value="custom">custom</option>
              </select>
            </div>
            <button type="submit" className="justify-self-start rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Add Site</button>
          </form>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Publishing Connections</h2>
          <div className="mt-3 space-y-2">
            {payload.publishingConnections.length === 0 ? <p className="text-sm text-zinc-400">No publishing connections yet.</p> : payload.publishingConnections.map((connection) => (
              <div key={connection.connectionId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                <p className="text-sm font-medium text-white">{connection.provider} • {connection.environment}</p>
                <p className="text-xs text-zinc-400">{connection.connectionStatus} • {connection.publishingStatus}</p>
              </div>
            ))}
          </div>

          <form className="mt-4 grid gap-2" onSubmit={(event) => void onCreateConnection(event)}>
            <select name="siteId" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
              <option value="">Select site</option>
              {siteOptions.map((site) => (
                <option key={site.siteId} value={site.siteId}>{site.displayName}</option>
              ))}
            </select>
            <div className="grid gap-2 sm:grid-cols-3">
              <select name="provider" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="wordpress">wordpress</option>
                <option value="shopify">shopify</option>
                <option value="webflow">webflow</option>
                <option value="contentful">contentful</option>
                <option value="headless_cms">headless_cms</option>
                <option value="custom_api">custom_api</option>
              </select>
              <select name="environment" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="development">development</option>
                <option value="staging">staging</option>
                <option value="production">production</option>
              </select>
              <select name="authenticationMethod" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="token">token</option>
                <option value="oauth2">oauth2</option>
                <option value="api_key">api_key</option>
                <option value="basic">basic</option>
                <option value="custom">custom</option>
              </select>
            </div>
            <input name="publishingCapabilities" defaultValue="draft,publish" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <button type="submit" className="justify-self-start rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Create Connection</button>
          </form>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Recent Executions</h2>
          <div className="mt-3 space-y-2">
            {payload.recentExecutions.length === 0 ? <p className="text-sm text-zinc-400">No runtime activity yet.</p> : payload.recentExecutions.map((execution) => (
              <div key={execution.executionId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                <p className="text-sm font-medium text-white">{execution.executionId}</p>
                <p className="text-xs text-zinc-400">{execution.status} • {formatDate(execution.timing.createdAt)}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Knowledge Readiness</h2>
          <div className="mt-3 space-y-3 text-sm text-zinc-300">
            <p><span className="font-medium text-white">Workspace Status:</span> {payload.knowledgeReadiness.workspaceStatus}</p>
            <p><span className="font-medium text-white">Completeness:</span> {payload.knowledgeReadiness.completenessScore}%</p>
            <p><span className="font-medium text-white">Approved Records:</span> {payload.knowledgeReadiness.approvedRecordCount}</p>
            <p><span className="font-medium text-white">Draft Records:</span> {payload.knowledgeReadiness.draftRecordCount}</p>
            <p><span className="font-medium text-white">Conflicts:</span> {payload.knowledgeReadiness.conflictCount}</p>
            <p><span className="font-medium text-white">Needs Review:</span> {payload.knowledgeReadiness.recordsRequiringReview}</p>
            <p><span className="font-medium text-white">Sources:</span> {payload.knowledgeReadiness.sourceCount}</p>
            <p><span className="font-medium text-white">Last Approved Version:</span> {payload.knowledgeReadiness.lastApprovedVersion}</p>
            <p><span className="font-medium text-white">Future GBG Connection:</span> {payload.knowledgeReadiness.futureBusinessGenomeConnectionStatus}</p>
            <p><span className="font-medium text-white">Content:</span> {payload.contentStatus.summary}</p>
            <p><span className="font-medium text-white">SEO:</span> {payload.seoStatus.summary}</p>
            <p className="text-zinc-500">Queue latency: {payload.runtimeHealth.queueLatencyMs}ms • Worker heartbeat lag: {payload.runtimeHealth.workerHeartbeatLagMs}ms</p>
          </div>
        </article>
      </section>

    </div>
  );
}
