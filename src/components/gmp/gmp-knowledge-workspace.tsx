"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { gmpKnowledgeDomains } from "@/lib/gmp/knowledge-models";

type KnowledgeMode = "overview" | "records" | "sources" | "conflicts" | "review";

type KnowledgeOverviewPayload = {
  knowledgeWorkspace: {
    knowledgeWorkspaceId: string;
    lifecycleState: string;
    workspaceVersion: number;
    completenessScore: number;
    confidenceScore: number;
  };
  readiness: {
    status: string;
    completenessScore: number;
    approvedRecordCount: number;
    draftRecordCount: number;
    conflictCount: number;
    requiresReviewCount: number;
    sourceCount: number;
    lastApprovedVersion: number;
    businessGenomeConnectionStatus: string;
  };
  latestCompleteness?: {
    overallScore: number;
    missingCriticalFields: string[];
    missingRecommendedFields: string[];
    conflictedFields: string[];
    unapprovedFields: string[];
    expiredFields: string[];
  } | null;
};

type KnowledgeRecord = {
  knowledgeRecordId: string;
  domain: string;
  canonicalKey: string;
  title: string;
  summary?: string;
  status: string;
  reviewState: string;
  conflictState: string;
  version: number;
};

type KnowledgeSource = {
  sourceId: string;
  sourceType: string;
  displayName: string;
  locationReference?: string;
  sourceVersion?: string;
};

type KnowledgeConflict = {
  conflict: {
    knowledgeConflictId: string;
    conflictGroup: string;
    conflictReason: string;
    severity: string;
    resolutionStatus: string;
  };
  members: Array<{
    knowledgeRecordId: string;
  }>;
};

type ReviewQueueItem = {
  knowledgeReviewId: string;
  knowledgeRecordId: string;
  reviewState: string;
  requestedBy?: string;
  requestedAt?: string;
};

function prettyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function GmpKnowledgeWorkspace({ projectId, mode }: { projectId: string; mode: KnowledgeMode }) {
  const [overview, setOverview] = useState<KnowledgeOverviewPayload | null>(null);
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [conflicts, setConflicts] = useState<KnowledgeConflict[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string>("");
  const [contextPreview, setContextPreview] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [overviewResponse, recordsResponse, sourcesResponse, conflictsResponse] = await Promise.all([
      fetch(`/api/gmp/projects/${projectId}/knowledge`, { credentials: "include", cache: "no-store" }).catch(() => null),
      fetch(`/api/gmp/projects/${projectId}/knowledge/records`, { credentials: "include", cache: "no-store" }).catch(() => null),
      fetch(`/api/gmp/projects/${projectId}/knowledge/sources`, { credentials: "include", cache: "no-store" }).catch(() => null),
      fetch(`/api/gmp/projects/${projectId}/knowledge/conflicts`, { credentials: "include", cache: "no-store" }).catch(() => null),
    ]);

    if (!overviewResponse?.ok || !recordsResponse?.ok || !sourcesResponse?.ok || !conflictsResponse?.ok) {
      setError("Unable to load knowledge workspace data.");
      return;
    }

    const overviewPayload = await overviewResponse.json() as KnowledgeOverviewPayload;
    const recordsPayload = await recordsResponse.json() as { records: KnowledgeRecord[] };
    const sourcesPayload = await sourcesResponse.json() as { sources: KnowledgeSource[] };
    const conflictsPayload = await conflictsResponse.json() as { conflicts: KnowledgeConflict[] };

    setOverview(overviewPayload);
    setRecords(recordsPayload.records ?? []);
    setSources(sourcesPayload.sources ?? []);
    setConflicts(conflictsPayload.conflicts ?? []);
    setError(null);
  }

  useEffect(() => {
    let active = true;

    const loadInitial = async () => {
      const [overviewResponse, recordsResponse, sourcesResponse, conflictsResponse] = await Promise.all([
        fetch(`/api/gmp/projects/${projectId}/knowledge`, { credentials: "include", cache: "no-store" }).catch(() => null),
        fetch(`/api/gmp/projects/${projectId}/knowledge/records`, { credentials: "include", cache: "no-store" }).catch(() => null),
        fetch(`/api/gmp/projects/${projectId}/knowledge/sources`, { credentials: "include", cache: "no-store" }).catch(() => null),
        fetch(`/api/gmp/projects/${projectId}/knowledge/conflicts`, { credentials: "include", cache: "no-store" }).catch(() => null),
      ]);

      if (!active) {
        return;
      }

      if (!overviewResponse?.ok || !recordsResponse?.ok || !sourcesResponse?.ok || !conflictsResponse?.ok) {
        setError("Unable to load knowledge workspace data.");
        return;
      }

      const overviewPayload = await overviewResponse.json() as KnowledgeOverviewPayload;
      const recordsPayload = await recordsResponse.json() as { records: KnowledgeRecord[] };
      const sourcesPayload = await sourcesResponse.json() as { sources: KnowledgeSource[] };
      const conflictsPayload = await conflictsResponse.json() as { conflicts: KnowledgeConflict[] };

      if (!active) {
        return;
      }

      setOverview(overviewPayload);
      setRecords(recordsPayload.records ?? []);
      setSources(sourcesPayload.sources ?? []);
      setConflicts(conflictsPayload.conflicts ?? []);
      setError(null);
    };

    void loadInitial();

    return () => {
      active = false;
    };
  }, [projectId]);

  const reviewQueue = useMemo(() => records
    .filter((record) => record.reviewState === "REQUIRES_REVIEW" || record.reviewState === "UNDER_REVIEW")
    .map((record) => ({
      knowledgeReviewId: `derived-${record.knowledgeRecordId}`,
      knowledgeRecordId: record.knowledgeRecordId,
      reviewState: record.reviewState,
    } as ReviewQueueItem)), [records]);

  const navItems = useMemo(() => ([
    { href: `/glw/projects/${projectId}/knowledge`, label: "Overview", key: "overview" },
    { href: `/glw/projects/${projectId}/knowledge/records`, label: "Records", key: "records" },
    { href: `/glw/projects/${projectId}/knowledge/sources`, label: "Sources", key: "sources" },
    { href: `/glw/projects/${projectId}/knowledge/conflicts`, label: "Conflicts", key: "conflicts" },
    { href: `/glw/projects/${projectId}/knowledge/review`, label: "Review", key: "review" },
  ]), [projectId]);

  async function onCreateRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const structuredValueRaw = String(form.get("structuredValue") ?? "{}");

    const response = await fetch(`/api/gmp/projects/${projectId}/knowledge/records`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: form.get("domain"),
        recordType: form.get("recordType"),
        canonicalKey: form.get("canonicalKey"),
        title: form.get("title"),
        summary: form.get("summary"),
        structuredValue: JSON.parse(structuredValueRaw),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Unable to create knowledge record.");
      return;
    }

    event.currentTarget.reset();
    await load();
  }

  async function onCreateSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/gmp/projects/${projectId}/knowledge/sources`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: form.get("sourceType"),
        displayName: form.get("displayName"),
        locationReference: form.get("locationReference"),
        sourceVersion: form.get("sourceVersion"),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Unable to register source.");
      return;
    }

    event.currentTarget.reset();
    await load();
  }

  async function onSubmitReview(recordId: string) {
    const response = await fetch(`/api/gmp/knowledge/records/${recordId}/review`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Submitted from workspace UI" }),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Unable to submit record for review.");
      return;
    }

    await load();
  }

  async function onApprove(recordId: string) {
    const response = await fetch(`/api/gmp/knowledge/records/${recordId}/approve`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Approved from workspace UI" }),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Unable to approve record.");
      return;
    }

    await load();
  }

  async function onReject(recordId: string) {
    const response = await fetch(`/api/gmp/knowledge/records/${recordId}/reject`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Rejected from workspace UI" }),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Unable to reject record.");
      return;
    }

    await load();
  }

  async function onRunCompleteness() {
    const response = await fetch(`/api/gmp/projects/${projectId}/knowledge/completeness/run`, {
      method: "POST",
      credentials: "include",
    }).catch(() => null);

    if (!response?.ok) {
      setError("Unable to run completeness assessment.");
      return;
    }

    await load();
  }

  async function onAssembleContext(previewMode: boolean) {
    const response = await fetch(`/api/gmp/projects/${projectId}/knowledge/context/assemble`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operationType: "PAGE",
        previewMode,
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Unable to assemble context.");
      return;
    }

    const payload = await response.json() as { context: { assembledContext: Record<string, unknown> } };
    setContextPreview(prettyJson(JSON.stringify(payload.context.assembledContext)));
  }

  async function onCreateEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRecordId) {
      setError("Select a record before adding evidence.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/gmp/knowledge/records/${selectedRecordId}/evidence`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: form.get("sourceId"),
        evidenceLocation: form.get("evidenceLocation"),
        evidenceSummary: form.get("evidenceSummary"),
        extractionMethod: form.get("extractionMethod"),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Unable to attach evidence.");
      return;
    }

    event.currentTarget.reset();
    await load();
  }

  async function onResolveConflict(event: FormEvent<HTMLFormElement>, conflictId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/gmp/knowledge/conflicts/${conflictId}/resolve`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedRecordId: form.get("selectedRecordId"),
        resolutionNotes: form.get("resolutionNotes"),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Unable to resolve conflict.");
      return;
    }

    await load();
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Business Knowledge Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Canonical Marketing Context</h1>
        <p className="mt-2 text-sm text-zinc-400">Create durable, reviewable marketing knowledge records with source traceability and deterministic context assembly.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`rounded-lg border px-3 py-1 text-xs ${mode === item.key ? "border-white bg-white text-zinc-900" : "border-zinc-700 text-zinc-200"}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {mode === "overview" && overview ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Workspace State</p><p className="mt-2 text-xl text-white">{overview.knowledgeWorkspace.lifecycleState}</p></article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Completeness</p><p className="mt-2 text-xl text-white">{overview.readiness.completenessScore}%</p></article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Confidence</p><p className="mt-2 text-xl text-white">{overview.knowledgeWorkspace.confidenceScore}%</p></article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Approved</p><p className="mt-2 text-xl text-white">{overview.readiness.approvedRecordCount}</p></article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Drafts</p><p className="mt-2 text-xl text-white">{overview.readiness.draftRecordCount}</p></article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Conflicts</p><p className="mt-2 text-xl text-white">{overview.readiness.conflictCount}</p></article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 lg:col-span-2">
            <p className="text-xs text-zinc-500">Missing Critical Fields</p>
            <p className="mt-2 text-sm text-zinc-200">{overview.latestCompleteness?.missingCriticalFields.join(", ") || "None"}</p>
          </article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <button type="button" onClick={() => void onRunCompleteness()} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-zinc-950">Run Completeness</button>
          </article>
        </section>
      ) : null}

      {mode === "records" ? (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Create Record</h2>
            <form className="mt-4 space-y-3" onSubmit={(event) => void onCreateRecord(event)}>
              <select name="domain" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                {gmpKnowledgeDomains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
              </select>
              <input name="recordType" required placeholder="record type" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="canonicalKey" required placeholder="canonical key" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="title" required placeholder="title" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <textarea name="summary" rows={2} placeholder="summary" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <textarea name="structuredValue" rows={5} defaultValue={"{\n  \"value\": \"\"\n}"} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-white" />
              <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Create Record</button>
            </form>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Record List</h2>
            <div className="mt-3 space-y-3">
              {records.length === 0 ? <p className="text-sm text-zinc-400">No records yet.</p> : records.map((record) => (
                <div key={record.knowledgeRecordId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <p className="text-sm font-medium text-white">{record.title}</p>
                  <p className="text-xs text-zinc-400">{record.domain} • {record.canonicalKey} • v{record.version} • {record.reviewState}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedRecordId(record.knowledgeRecordId)} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-100">Select</button>
                    <button type="button" onClick={() => void onSubmitReview(record.knowledgeRecordId)} className="rounded-lg border border-amber-700 px-2 py-1 text-xs text-amber-300">Submit Review</button>
                    <button type="button" onClick={() => void onApprove(record.knowledgeRecordId)} className="rounded-lg border border-emerald-700 px-2 py-1 text-xs text-emerald-300">Approve</button>
                    <button type="button" onClick={() => void onReject(record.knowledgeRecordId)} className="rounded-lg border border-rose-700 px-2 py-1 text-xs text-rose-300">Reject</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-zinc-800 p-3">
              <p className="text-xs text-zinc-500">Attach Evidence to Selected Record</p>
              <form className="mt-2 space-y-2" onSubmit={(event) => void onCreateEvidence(event)}>
                <select name="sourceId" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                  <option value="">Select source</option>
                  {sources.map((source) => <option key={source.sourceId} value={source.sourceId}>{source.displayName}</option>)}
                </select>
                <input name="evidenceLocation" placeholder="Evidence location" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                <input name="extractionMethod" defaultValue="manual" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                <textarea name="evidenceSummary" rows={2} placeholder="Evidence summary" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Attach Evidence</button>
              </form>
            </div>
          </article>
        </section>
      ) : null}

      {mode === "sources" ? (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Register Source</h2>
            <form className="mt-4 space-y-3" onSubmit={(event) => void onCreateSource(event)}>
              <select name="sourceType" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="MANUAL_ENTRY">MANUAL_ENTRY</option>
                <option value="WEBSITE">WEBSITE</option>
                <option value="DOCUMENT">DOCUMENT</option>
                <option value="SPREADSHEET">SPREADSHEET</option>
                <option value="PRESENTATION">PRESENTATION</option>
                <option value="IMAGE">IMAGE</option>
                <option value="EMAIL">EMAIL</option>
                <option value="TRANSCRIPT">TRANSCRIPT</option>
                <option value="EXTERNAL_URL">EXTERNAL_URL</option>
                <option value="API">API</option>
                <option value="LEGACY_SYSTEM">LEGACY_SYSTEM</option>
                <option value="FUTURE_GBG_OBJECT">FUTURE_GBG_OBJECT</option>
              </select>
              <input name="displayName" required placeholder="Source display name" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="locationReference" placeholder="Location reference" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="sourceVersion" placeholder="Source version" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Create Source</button>
            </form>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Source Registry</h2>
            <div className="mt-3 space-y-2">
              {sources.length === 0 ? <p className="text-sm text-zinc-400">No sources registered.</p> : sources.map((source) => (
                <div key={source.sourceId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <p className="text-sm font-medium text-white">{source.displayName}</p>
                  <p className="text-xs text-zinc-400">{source.sourceType}{source.locationReference ? ` • ${source.locationReference}` : ""}{source.sourceVersion ? ` • ${source.sourceVersion}` : ""}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {mode === "conflicts" ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Conflict Center</h2>
          <p className="mt-1 text-sm text-zinc-400">Resolve deterministic conflicts detected across active records with the same canonical key.</p>
          <div className="mt-4 space-y-3">
            {conflicts.length === 0 ? <p className="text-sm text-zinc-400">No conflicts currently detected.</p> : conflicts.map((entry) => (
              <div key={entry.conflict.knowledgeConflictId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-sm font-medium text-white">{entry.conflict.conflictGroup}</p>
                <p className="text-xs text-zinc-400">{entry.conflict.conflictReason} • {entry.conflict.severity} • {entry.conflict.resolutionStatus}</p>
                <p className="mt-1 text-xs text-zinc-500">Affected records: {entry.members.map((member) => member.knowledgeRecordId).join(", ")}</p>
                {entry.conflict.resolutionStatus !== "RESOLVED" ? (
                  <form className="mt-2 grid gap-2" onSubmit={(event) => void onResolveConflict(event, entry.conflict.knowledgeConflictId)}>
                    <input name="selectedRecordId" placeholder="Selected canonical record ID" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white" />
                    <input name="resolutionNotes" placeholder="Resolution notes" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white" />
                    <button type="submit" className="justify-self-start rounded-xl bg-white px-3 py-2 text-xs font-semibold text-zinc-950">Resolve Conflict</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "review" ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Review Queue</h2>
            <div className="mt-3 space-y-2">
              {reviewQueue.length === 0 ? <p className="text-sm text-zinc-400">No records currently in review queue.</p> : reviewQueue.map((entry) => (
                <div key={entry.knowledgeReviewId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <p className="text-sm font-medium text-white">{entry.knowledgeRecordId}</p>
                  <p className="text-xs text-zinc-400">{entry.reviewState}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => void onApprove(entry.knowledgeRecordId)} className="rounded-lg border border-emerald-700 px-2 py-1 text-xs text-emerald-300">Approve</button>
                    <button type="button" onClick={() => void onReject(entry.knowledgeRecordId)} className="rounded-lg border border-rose-700 px-2 py-1 text-xs text-rose-300">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Context Preview</h2>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => void onAssembleContext(false)} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-zinc-950">Assemble Approved Context</button>
              <button type="button" onClick={() => void onAssembleContext(true)} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-200">Preview Unapproved Context</button>
            </div>
            <pre className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200">{contextPreview || "Run context assembly to preview deterministic context package."}</pre>
          </article>
        </section>
      ) : null}
    </div>
  );
}
