"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ContentMode = "overview" | "generate" | "draft" | "review" | "lineage";

type EligibilityPayload = {
  eligibility?: {
    eligible: boolean;
    blockingIssues: string[];
    warnings: string[];
    requiredInputs: string[];
    missingInputs: string[];
    pageVersion: number;
    briefVersion?: number;
    planVersion?: number;
    knowledgeWorkspaceVersion?: number;
    eligibilityModelVersion: string;
  } | null;
  permissions?: {
    canCreateDraft: boolean;
    canGenerate: boolean;
    canEdit: boolean;
    canSubmitReview: boolean;
    canReview: boolean;
    canApprove: boolean;
    canRunValidation: boolean;
    canViewLineage: boolean;
  };
};

type DraftSummary = {
  contentDraftId: string;
  generationStatus: string;
  editorialStatus: string;
  approvalStatus: string;
  provider: string;
  modelIdentifier: string;
  createdAt: string;
  updatedAt: string;
};

type DraftListPayload = {
  drafts: DraftSummary[];
  permissions?: EligibilityPayload["permissions"];
};

type DraftDetailPayload = {
  draft: DraftSummary & Record<string, unknown>;
  sections: Array<{
    sectionContentId: string;
    pageSectionStableKey: string;
    heading?: string;
    bodyContent?: string;
    generationStatus: string;
    editorialStatus: string;
    approvalStatus: string;
    wordCount: number;
    ctaContent: Record<string, unknown>;
    mediaGuidance: Record<string, unknown>;
    internalLinkSuggestions: Array<Record<string, unknown>>;
  }>;
  requests: Array<{ generationRequestId: string; status: string; operationType: string; requestedAt: string; gopExecutionId?: string }>;
  reviews: Array<Record<string, unknown>>;
  approvals: Array<Record<string, unknown>>;
  validation?: { overallScore: number; blockingIssues: string[]; warnings: string[]; recommendations: string[]; sectionScores: Array<{ sectionContentId: string; score: number }> } | null;
  preview?: Record<string, unknown> | null;
  permissions?: EligibilityPayload["permissions"];
};

type LineagePayload = { lineage: Array<Record<string, unknown>> };

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </article>
  );
}

export function GmpContentWorkspace({ projectId, pageId, draftId, mode }: { projectId: string; pageId: string; draftId?: string; mode: ContentMode }) {
  const [eligibility, setEligibility] = useState<EligibilityPayload | null>(null);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [draftDetail, setDraftDetail] = useState<DraftDetailPayload | null>(null);
  const [lineage, setLineage] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const permissions = draftDetail?.permissions ?? eligibility?.permissions ?? null;

  const loadEligibility = useCallback(async () => {
    const response = await fetch(`/api/gmp/pages/${pageId}/content/eligibility`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    setEligibility(await response.json() as EligibilityPayload);
  }, [pageId]);

  const loadDrafts = useCallback(async () => {
    const response = await fetch(`/api/gmp/pages/${pageId}/content/drafts`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const payload = await response.json() as DraftListPayload;
    setDrafts(payload.drafts ?? []);
  }, [pageId]);

  const loadDraft = useCallback(async () => {
    if (!draftId) {
      setDraftDetail(null);
      return;
    }
    const response = await fetch(`/api/gmp/content/drafts/${draftId}`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    setDraftDetail(await response.json() as DraftDetailPayload);
  }, [draftId]);

  const loadLineage = useCallback(async () => {
    if (!draftId) {
      setLineage([]);
      return;
    }
    const response = await fetch(`/api/gmp/content/drafts/${draftId}/lineage`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const payload = await response.json() as LineagePayload;
    setLineage(payload.lineage ?? []);
  }, [draftId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await loadEligibility();
      await loadDrafts();
      if (!active) return;
      if (draftId) {
        await loadDraft();
        if (mode === "lineage") {
          await loadLineage();
        }
      }
    })();
    return () => { active = false; };
  }, [draftId, loadDraft, loadDrafts, loadEligibility, loadLineage, mode]);

  const selectedDraft = useMemo(() => draftDetail?.draft ?? drafts[0] ?? null, [draftDetail?.draft, drafts]);

  async function onCreateDraft() {
    const response = await fetch(`/api/gmp/pages/${pageId}/content/drafts`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => null);
    if (!response?.ok) {
      setError("Unable to create content draft.");
      return;
    }
    setMessage("Content draft created.");
    await loadDrafts();
  }

  async function onGenerateDraft() {
    if (!draftId) return;
    const response = await fetch(`/api/gmp/content/drafts/${draftId}/generate`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => null);
    if (!response?.ok) {
      setError("Unable to generate draft content.");
      return;
    }
    setMessage("Generation started.");
    await loadDraft();
    await loadLineage();
  }

  async function onRunValidation() {
    if (!draftId) return;
    const response = await fetch(`/api/gmp/content/drafts/${draftId}/validation/run`, { method: "POST", credentials: "include" }).catch(() => null);
    if (!response?.ok) {
      setError("Unable to validate draft.");
      return;
    }
    setMessage("Validation completed.");
    await loadDraft();
  }

  async function onSubmitReview() {
    if (!draftId) return;
    const response = await fetch(`/api/gmp/content/drafts/${draftId}/review`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: "Submitted from content workspace." }) }).catch(() => null);
    if (!response?.ok) {
      setError("Unable to submit draft for review.");
      return;
    }
    await loadDraft();
  }

  async function onDraftDecision(action: "approve" | "reject" | "request-changes") {
    if (!draftId) return;
    const response = await fetch(`/api/gmp/content/drafts/${draftId}/${action}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: `Draft ${action} from workspace.` }) }).catch(() => null);
    if (!response?.ok) {
      setError(`Unable to ${action} draft.`);
      return;
    }
    await loadDraft();
  }

  async function onSaveSection(event: FormEvent<HTMLFormElement>, sectionContentId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/gmp/content/sections/${sectionContentId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heading: form.get("heading"),
        bodyContent: form.get("bodyContent"),
        reason: form.get("reason"),
        ctaContent: { label: form.get("ctaLabel") },
        mediaGuidance: { note: form.get("mediaNote") },
      }),
    }).catch(() => null);
    if (!response?.ok) {
      setError("Unable to save section draft.");
      return;
    }
    await loadDraft();
  }

  async function onSectionAction(sectionContentId: string, action: "approve" | "reject" | "request-changes" | "regenerate" | "validate") {
    const response = await fetch(`/api/gmp/content/sections/${sectionContentId}/${action}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: `Section ${action} from workspace.` }),
    }).catch(() => null);
    if (!response?.ok) {
      setError(`Unable to ${action} section.`);
      return;
    }
    await loadDraft();
    await loadLineage();
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Content Generation Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Editorial Drafts</h1>
        <p className="mt-2 text-sm text-zinc-400">Generate, validate, revise, review, approve, and trace structured content drafts without mutating the canonical planning layer.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/glw/projects/${projectId}/pages/${pageId}/content`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Overview</Link>
          <Link href={`/glw/projects/${projectId}/pages/${pageId}/content/generate`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Generate</Link>
          {selectedDraft ? <Link href={`/glw/projects/${projectId}/pages/${pageId}/content/${String(selectedDraft.contentDraftId)}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Current Draft</Link> : null}
          {selectedDraft ? <Link href={`/glw/projects/${projectId}/pages/${pageId}/content/${String(selectedDraft.contentDraftId)}/review`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Review</Link> : null}
          {selectedDraft ? <Link href={`/glw/projects/${projectId}/pages/${pageId}/content/${String(selectedDraft.contentDraftId)}/lineage`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Lineage</Link> : null}
        </div>
      </section>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Card title="Generation Eligibility">
          {eligibility?.eligibility ? (
            <div className="space-y-3 text-sm text-zinc-300">
              <p><span className="font-medium text-white">Eligible:</span> {String(eligibility.eligibility.eligible)}</p>
              <p><span className="font-medium text-white">Model:</span> {eligibility.eligibility.eligibilityModelVersion}</p>
              <p><span className="font-medium text-white">Missing Inputs:</span> {eligibility.eligibility.missingInputs.join(", ") || "None"}</p>
              <p><span className="font-medium text-white">Blocking Issues:</span> {eligibility.eligibility.blockingIssues.join(", ") || "None"}</p>
              <p><span className="font-medium text-white">Warnings:</span> {eligibility.eligibility.warnings.join(", ") || "None"}</p>
              {permissions?.canCreateDraft ? <button type="button" onClick={() => void onCreateDraft()} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Create Draft</button> : null}
            </div>
          ) : <p className="text-sm text-zinc-400">Eligibility unavailable.</p>}
        </Card>

        <Card title="Content Drafts">
          <div className="space-y-3 text-sm text-zinc-300">
            {drafts.map((draft) => (
              <Link key={draft.contentDraftId} href={`/glw/projects/${projectId}/pages/${pageId}/content/${draft.contentDraftId}`} className="block rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="font-medium text-white">{draft.contentDraftId}</p>
                <p className="text-xs text-zinc-400">{draft.generationStatus} • {draft.editorialStatus} • {draft.approvalStatus}</p>
              </Link>
            ))}
            {drafts.length === 0 ? <p className="text-zinc-500">No drafts yet.</p> : null}
          </div>
        </Card>
      </div>

      {draftDetail ? (
        <div className="grid gap-6">
          <Card title="Draft Controls">
            <div className="flex flex-wrap gap-2">
              {permissions?.canGenerate ? <button type="button" onClick={() => void onGenerateDraft()} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-950">Generate</button> : null}
              {permissions?.canRunValidation ? <button type="button" onClick={() => void onRunValidation()} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Run Validation</button> : null}
              {permissions?.canSubmitReview ? <button type="button" onClick={() => void onSubmitReview()} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Submit Review</button> : null}
              {permissions?.canApprove ? <button type="button" onClick={() => void onDraftDecision("approve")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Approve Draft</button> : null}
              {permissions?.canReview ? <button type="button" onClick={() => void onDraftDecision("request-changes")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Request Changes</button> : null}
              {permissions?.canApprove ? <button type="button" onClick={() => void onDraftDecision("reject")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Reject Draft</button> : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-zinc-300">
              <p><span className="font-medium text-white">Generation:</span> {String(draftDetail.draft.generationStatus)}</p>
              <p><span className="font-medium text-white">Editorial:</span> {String(draftDetail.draft.editorialStatus)}</p>
              <p><span className="font-medium text-white">Approval:</span> {String(draftDetail.draft.approvalStatus)}</p>
            </div>
          </Card>

          <Card title="Draft Validation">
            {draftDetail.validation ? (
              <div className="space-y-3 text-sm text-zinc-300">
                <p><span className="font-medium text-white">Overall Score:</span> {draftDetail.validation.overallScore}</p>
                <p><span className="font-medium text-white">Blocking Issues:</span> {draftDetail.validation.blockingIssues.join(", ") || "None"}</p>
                <p><span className="font-medium text-white">Warnings:</span> {draftDetail.validation.warnings.join(", ") || "None"}</p>
                <p><span className="font-medium text-white">Recommendations:</span> {draftDetail.validation.recommendations.join(", ") || "None"}</p>
              </div>
            ) : <p className="text-sm text-zinc-500">Validation has not been run yet.</p>}
          </Card>

          <Card title="Generated Sections">
            <div className="space-y-4">
              {draftDetail.sections.map((section) => (
                <form key={section.sectionContentId} onSubmit={(event) => void onSaveSection(event, section.sectionContentId)} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{section.pageSectionStableKey}</p>
                      <p className="text-xs text-zinc-400">{section.generationStatus} • {section.editorialStatus} • {section.approvalStatus} • {section.wordCount} words</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void onSectionAction(section.sectionContentId, "validate")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Validate</button>
                      <button type="button" onClick={() => void onSectionAction(section.sectionContentId, "regenerate")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Regenerate</button>
                      <button type="button" onClick={() => void onSectionAction(section.sectionContentId, "approve")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Approve</button>
                      <button type="button" onClick={() => void onSectionAction(section.sectionContentId, "request-changes")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Request Changes</button>
                    </div>
                  </div>
                  <input name="heading" defaultValue={section.heading} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
                  <textarea name="bodyContent" defaultValue={section.bodyContent} rows={8} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
                  <div className="grid gap-2 md:grid-cols-2">
                    <input name="ctaLabel" defaultValue={String(section.ctaContent.label ?? "")} placeholder="CTA label" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
                    <input name="mediaNote" defaultValue={String(section.mediaGuidance.note ?? "")} placeholder="Media guidance" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
                  </div>
                  <input name="reason" placeholder="Revision reason" className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
                  <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Save Section</button>
                </form>
              ))}
            </div>
          </Card>

          {mode === "lineage" ? (
            <Card title="Generation Lineage">
              <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300">{pretty(lineage)}</pre>
            </Card>
          ) : null}

          <Card title="Assembled Preview">
            <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300">{pretty(draftDetail.preview ?? {})}</pre>
          </Card>

          <Card title="Generation Timeline">
            <div className="space-y-3 text-sm text-zinc-300">
              {draftDetail.requests.map((request) => (
                <div key={request.generationRequestId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <p className="font-medium text-white">{request.operationType}</p>
                  <p className="text-xs text-zinc-400">{request.status} • {formatDate(request.requestedAt)} • {request.gopExecutionId ?? "no execution"}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
