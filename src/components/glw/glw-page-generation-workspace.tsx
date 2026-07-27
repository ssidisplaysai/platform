"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "./data-table";
import { EmptyState } from "./empty-state";
import { GlwJobPanel } from "./glw-job-panel";
import { GlwJobProgress } from "./glw-job-progress";
import { PageContainer } from "./page-container";
import { SectionHeader } from "./section-header";
import {
  formatGlwJobDuration,
  getGlwJobOperatorSnapshot,
  type GlwJobRecord,
} from "@/lib/glw/jobs";
import { glwSites, type GlwSite } from "@/lib/glw/sites";

type GlwPageGenerationWorkspaceProps = {
  initialJobs: GlwJobRecord[];
  initialSelectedJob: GlwJobRecord | null;
  initialSiteId?: string;
};

type GenerationFormState = {
  siteId: string;
  title: string;
  targetSlug: string;
  primaryKeyword: string;
  secondaryKeywords: string;
  wordCount: string;
  tone: string;
  audience: string;
  callToAction: string;
  category: string;
  status: "draft" | "publish";
};

type FieldErrors = Partial<Record<keyof GenerationFormState, string>>;

type JobsPayload = {
  jobs?: GlwJobRecord[];
  error?: string;
};

const initialFormState: GenerationFormState = {
  siteId: "led-display-warehouse",
  title: "LED Wall Rental Package",
  targetSlug: "led-wall-rental-package",
  primaryKeyword: "led wall rental",
  secondaryKeywords: "event led wall, mobile led display",
  wordCount: "1500",
  tone: "Confident",
  audience: "Event marketing teams",
  callToAction: "Request a same-day quote",
  category: "Rentals",
  status: "draft",
};

function createFormData(formState: GenerationFormState): FormData {
  const formData = new FormData();

  formData.set("siteId", formState.siteId);
  formData.set("title", formState.title);
  formData.set("targetSlug", formState.targetSlug);
  formData.set("primaryKeyword", formState.primaryKeyword);
  formData.set("secondaryKeywords", formState.secondaryKeywords);
  formData.set("wordCount", formState.wordCount);
  formData.set("tone", formState.tone);
  formData.set("audience", formState.audience);
  formData.set("callToAction", formState.callToAction);
  formData.set("category", formState.category);
  formData.set("status", formState.status);

  return formData;
}

function validateForm(formState: GenerationFormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!formState.siteId.trim()) errors.siteId = "Site is required.";
  if (!formState.title.trim()) errors.title = "Title is required.";
  if (!formState.targetSlug.trim()) errors.targetSlug = "Target URL slug is required.";
  if (!/^[-a-z0-9]+$/.test(formState.targetSlug.trim())) errors.targetSlug = "Slug must use lowercase letters, numbers, and hyphens only.";
  if (!formState.category.trim()) errors.category = "Category is required.";
  if (!formState.primaryKeyword.trim()) errors.primaryKeyword = "Primary keyword is required.";
  if (!formState.secondaryKeywords.trim()) errors.secondaryKeywords = "Secondary keywords are required.";
  const wordCountValue = Number(formState.wordCount);
  if (!Number.isFinite(wordCountValue) || wordCountValue < 300 || wordCountValue > 5000) errors.wordCount = "Word count must be between 300 and 5000.";
  if (!formState.tone.trim()) errors.tone = "Tone is required.";
  if (!formState.audience.trim()) errors.audience = "Audience is required.";
  if (!formState.callToAction.trim()) errors.callToAction = "Call-to-action is required.";
  if (!formState.status.trim()) errors.status = "Status is required.";

  return errors;
}

function fieldError(errors: FieldErrors, key: keyof GenerationFormState): string | undefined {
  return errors[key];
}

function mergeJobs(current: GlwJobRecord[], incoming: GlwJobRecord[]): GlwJobRecord[] {
  const currentMap = new Map(current.map((job) => [job.id, job]));
  let changed = current.length !== incoming.length;

  const merged = incoming.map((job) => {
    const previous = currentMap.get(job.id);

    if (!previous || previous.updatedAt !== job.updatedAt || previous.status !== job.status) {
      changed = true;
      return job;
    }

    return previous;
  });

  if (!changed) {
    return current;
  }

  return merged;
}

function getLatestRunningJob(jobs: GlwJobRecord[]): GlwJobRecord | null {
  return [...jobs]
    .filter((job) => job.status === "QUEUED" || job.status === "STARTING" || job.status === "RUNNING" || job.status === "GENERATING_CONTENT" || job.status === "GENERATING_IMAGE" || job.status === "UPLOADING_IMAGE" || job.status === "PUBLISHING")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

function getWorkflowVersionLabel(job: GlwJobRecord): string {
  return job.type === "PAGE_GENERATION" ? "Page Engine v1" : "Blog Engine v1";
}

function getOperatorLabel(): string {
  return "Operations Admin";
}

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) {
    return "--";
  }

  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function mapProgressStatus(snapshotDisplayStatus: string): "running" | "queued" | "succeeded" | "failed" {
  const normalized = snapshotDisplayStatus.toLowerCase();

  if (normalized.includes("complete")) {
    return "succeeded";
  }

  if (normalized.includes("fail") || normalized.includes("timed out")) {
    return "failed";
  }

  if (normalized.includes("queued") || normalized.includes("starting")) {
    return "queued";
  }

  return "running";
}

function statePalette(displayStatus: string): string {
  const normalized = displayStatus.toLowerCase();

  if (normalized.includes("complete")) {
    return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  }

  if (normalized.includes("fail") || normalized.includes("timed out")) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }

  if (normalized.includes("queued") || normalized.includes("starting")) {
    return "border-zinc-700 bg-zinc-800 text-zinc-300";
  }

  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function StatusChip({ displayStatus }: { displayStatus: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${statePalette(displayStatus)}`}>
      <span className="inline-block h-2 w-2 rounded-full bg-current" aria-hidden="true" />
      {displayStatus}
    </span>
  );
}

export function GlwPageGenerationWorkspace({ initialJobs, initialSelectedJob, initialSiteId }: GlwPageGenerationWorkspaceProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState<GlwJobRecord[]>(initialJobs);
  const [selectedJob, setSelectedJob] = useState<GlwJobRecord | null>(initialSelectedJob ?? getLatestRunningJob(initialJobs));
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [formState, setFormState] = useState<GenerationFormState>({
    ...initialFormState,
    siteId: initialSiteId ?? initialFormState.siteId,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, startTransition] = useTransition();
  const selectedJobSectionId = "glw-selected-job-details";

  const selectedSite = useMemo(() => glwSites.find((site) => site.id === formState.siteId) ?? glwSites[0], [formState.siteId]);

  const duplicateRequestFromJob = (job: GlwJobRecord) => {
    setFormState({
      siteId: job.input.site.id,
      title: job.input.page.title,
      targetSlug: job.input.page.targetSlug,
      primaryKeyword: job.input.page.primaryKeyword,
      secondaryKeywords: job.input.page.secondaryKeywords.join(", "),
      wordCount: String(job.input.page.wordCount),
      tone: job.input.page.tone,
      audience: job.input.page.audience,
      callToAction: job.input.page.callToAction,
      category: job.input.page.category,
      status: job.input.page.status,
    });
    setServerError(null);
    setErrors({});
    setSelectedJob(job);
    setIsCreateMode(true);
  };

  const openGenerator = () => {
    setServerError(null);
    setErrors({});
    setSelectedJob(null);
    setIsCreateMode(true);
  };

  const createJob = async () => {
    const nextErrors = validateForm(formState);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setServerError(null);

    const request = createFormData(formState);

    const response = await fetch("/api/glw/jobs/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(Object.fromEntries(request.entries())),
    });

    const payload = await response.json().catch(() => null) as { job?: GlwJobRecord; fieldErrors?: FieldErrors; error?: string } | null;

    if (!response.ok || !payload?.job) {
      if (payload?.fieldErrors) {
        setErrors(payload.fieldErrors);
      }

      setServerError(payload?.error ?? "Unable to create the GLW job.");
      return;
    }

    setJobs((current) => [payload.job as GlwJobRecord, ...current.filter((job) => job.id !== payload.job!.id)]);
    setSelectedJob(payload.job);
    setIsCreateMode(false);
    router.refresh();
  };

  const handleSubmit = () => {
    startTransition(() => {
      void createJob();
    });
  };

  const refreshJob = async (jobId: string): Promise<GlwJobRecord> => {
    const response = await fetch(`/api/glw/jobs/${jobId}`, {
      credentials: "include",
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null) as { job?: GlwJobRecord } | null;

    if (!response.ok || !payload?.job) {
      throw new Error("Unable to load the current job state.");
    }

    setSelectedJob(payload.job);
    setJobs((current) => [payload.job as GlwJobRecord, ...current.filter((job) => job.id !== payload.job!.id)]);
    return payload.job;
  };

  const retryJob = async (jobId: string): Promise<GlwJobRecord> => {
    const response = await fetch(`/api/glw/jobs/${jobId}/retry`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    const payload = await response.json().catch(() => null) as { job?: GlwJobRecord; error?: string } | null;

    if (!response.ok || !payload?.job) {
      throw new Error(payload?.error ?? "Unable to retry the GLW job.");
    }

    setSelectedJob(payload.job);
    setJobs((current) => [payload.job as GlwJobRecord, ...current.filter((job) => job.id !== payload.job!.id)]);
    return payload.job;
  };

  useEffect(() => {
    let cancelled = false;

    const pollJobs = async () => {
      const response = await fetch("/api/glw/jobs?filter=all&limit=200", {
        cache: "no-store",
        credentials: "include",
      }).catch(() => null);

      if (!response || !response.ok || cancelled) {
        return;
      }

      const payload = await response.json().catch(() => null) as JobsPayload | null;

      if (!payload?.jobs || cancelled) {
        return;
      }

      setJobs((current) => mergeJobs(current, payload.jobs!));

      if (!isCreateMode) {
        if (selectedJob) {
          const refreshedSelected = payload.jobs.find((job) => job.id === selectedJob.id);
          if (refreshedSelected) {
            setSelectedJob(refreshedSelected);
          }
        } else {
          const newestRunning = getLatestRunningJob(payload.jobs);
          if (newestRunning) {
            setSelectedJob(newestRunning);
          }
        }
      }
    };

    void pollJobs();
    const interval = window.setInterval(() => {
      void pollJobs();
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isCreateMode, selectedJob]);

  const recentRows = useMemo(() => jobs.map((job) => {
    const snapshot = getGlwJobOperatorSnapshot(job);

    return {
      id: job.id,
      status: snapshot.displayStatus,
      statusKind: mapProgressStatus(snapshot.displayStatus),
      progress: snapshot.progressPercent,
      title: job.title,
      subtitle: [job.input.site.name, job.input.page.targetSlug, `Updated ${formatRelativeTime(job.updatedAt)}`].join(" • "),
      site: job.input.site.name,
      location: job.input.page.targetSlug,
      started: formatRelativeTime(job.startedAt),
      updated: formatRelativeTime(job.updatedAt),
      duration: formatGlwJobDuration(job),
      operator: getOperatorLabel(),
      workflowVersion: getWorkflowVersionLabel(job),
      actionLabel: job.status === "FAILED" ? "Retry" : job.status === "COMPLETE" ? "Open WordPress Draft" : "View Details",
    };
  }), [jobs]);

  return (
    <PageContainer className="w-full min-w-0 space-y-6 bg-zinc-950 p-4 sm:space-y-8 sm:p-6">
      <SectionHeader
        eyebrow="Pages"
        title="Pages"
        description="Generate production pages, track workflow execution, and keep operators inside a live Genesis workspace."
        actions={
          <button
            type="button"
            onClick={openGenerator}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Generate Page
          </button>
        }
      />

      {isCreateMode ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm shadow-zinc-950/20">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 sm:px-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Generate Page</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Create Page Request</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateMode(false)}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              Close
            </button>
          </div>

          <GeneratorForm
            formState={formState}
            setFormState={setFormState}
            errors={errors}
            serverError={serverError}
            isSubmitting={isSubmitting}
            onClose={() => setIsCreateMode(false)}
            onSubmit={handleSubmit}
            site={selectedSite}
          />
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm shadow-zinc-950/20">
        <div className="border-b border-zinc-800 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">Recent page-generation jobs</h2>
              <p className="mt-1 text-sm text-zinc-400">Current and recent GLW jobs are tracked in the database and refreshed from the server.</p>
            </div>
            <p className="text-sm text-zinc-400">{recentRows.length} jobs</p>
          </div>
        </div>

        <DataTable
          rows={recentRows}
          rowKey={(row) => row.id}
          selectedRowKey={selectedJob?.id}
          onRowClick={(row) => {
            const matching = jobs.find((job) => job.id === row.id);
            if (matching) {
              setSelectedJob(matching);
              setIsCreateMode(false);
              document.getElementById(selectedJobSectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          emptyState={
            <div className="p-5 sm:p-6">
              <EmptyState
                title="No page-generation jobs yet"
                description="Use Generate Page to create the first tracked GLW workflow and monitor it here."
              />
            </div>
          }
          columns={[
            {
              header: "Status",
              className: "w-40 whitespace-nowrap",
              cell: (row) => <StatusChip displayStatus={row.status} />,
            },
            {
              header: "Progress",
              className: "w-44",
              cell: (row) => <GlwJobProgress progress={row.progress} label={`${Math.round(row.progress)}%`} className="w-full" />,
            },
            {
              header: "Title",
              className: "min-w-0",
              cell: (row) => (
                <div className="space-y-1 min-w-0">
                  <p className="break-words font-medium text-white">{row.title}</p>
                  <p className="break-words text-xs text-zinc-500">{row.subtitle}</p>
                </div>
              ),
            },
            {
              header: "Started",
              className: "w-32 whitespace-nowrap text-zinc-300",
              cell: (row) => <span>{row.started}</span>,
            },
            {
              header: "Duration",
              className: "w-28 whitespace-nowrap text-zinc-300",
              cell: (row) => <span className="font-medium text-zinc-200">{row.duration}</span>,
            },
            {
              header: "Action",
              className: "w-40 whitespace-nowrap text-right",
              cell: (row) => (
                <button
                  type="button"
                  aria-label={`Open job ${row.id}`}
                  onClick={async (event) => {
                    event.stopPropagation();
                    setIsCreateMode(false);
                    const refreshed = await refreshJob(row.id);
                    setSelectedJob(refreshed);
                    document.getElementById(selectedJobSectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white transition hover:border-zinc-700 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  {row.actionLabel}
                </button>
              ),
            },
          ]}
        />
      </section>

      <section id={selectedJobSectionId} className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm shadow-zinc-950/20 sm:p-6">
        <div className="flex flex-col gap-2 border-b border-zinc-800 pb-5">
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Selected Job</p>
          <h2 className="text-xl font-semibold tracking-tight text-white">Job details and workflow inspector</h2>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">Open a job from the list to inspect its progress, timeline, results, diagnostics, and operator actions below.</p>
        </div>

        <GlwJobPanel
          job={selectedJob}
          relatedJobs={jobs}
          onRetry={retryJob}
          onDuplicateRequest={duplicateRequestFromJob}
        />
      </section>
    </PageContainer>
  );
}

function GeneratorForm({
  formState,
  setFormState,
  errors,
  serverError,
  isSubmitting,
  onClose,
  onSubmit,
  site,
}: {
  formState: GenerationFormState;
  setFormState: Dispatch<SetStateAction<GenerationFormState>>;
  errors: FieldErrors;
  serverError: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  site: GlwSite;
}) {
  return (
    <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Field>
          <Label htmlFor="siteId">Site</Label>
          <select
            id="siteId"
            name="siteId"
            value={formState.siteId}
            onChange={(event) => setFormState((current) => ({ ...current, siteId: event.target.value }))}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-2 focus:ring-red-500"
          >
            {glwSites.map((glwSite) => (
              <option key={glwSite.id} value={glwSite.id}>{glwSite.name}</option>
            ))}
          </select>
          {fieldError(errors, "siteId") ? <FieldError message={fieldError(errors, "siteId")!} /> : null}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="title">Title</Label>
            <input id="title" value={formState.title} onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-2 focus:ring-red-500" />
            {fieldError(errors, "title") ? <FieldError message={fieldError(errors, "title")!} /> : null}
          </Field>

          <Field>
            <Label htmlFor="category">Category</Label>
            <input id="category" value={formState.category} onChange={(event) => setFormState((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-2 focus:ring-red-500" />
            {fieldError(errors, "category") ? <FieldError message={fieldError(errors, "category")!} /> : null}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="targetSlug">Target URL Slug</Label>
            <input id="targetSlug" value={formState.targetSlug} onChange={(event) => setFormState((current) => ({ ...current, targetSlug: event.target.value }))} placeholder="led-wall-rental-package" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-2 focus:ring-red-500" />
            {fieldError(errors, "targetSlug") ? <FieldError message={fieldError(errors, "targetSlug")!} /> : null}
          </Field>
          <Field>
            <Label htmlFor="wordCount">Word Count</Label>
            <input id="wordCount" inputMode="numeric" value={formState.wordCount} onChange={(event) => setFormState((current) => ({ ...current, wordCount: event.target.value }))} placeholder="1500" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-2 focus:ring-red-500" />
            {fieldError(errors, "wordCount") ? <FieldError message={fieldError(errors, "wordCount")!} /> : null}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="primaryKeyword">Primary Keyword</Label>
            <input id="primaryKeyword" value={formState.primaryKeyword} onChange={(event) => setFormState((current) => ({ ...current, primaryKeyword: event.target.value }))} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-2 focus:ring-red-500" />
            {fieldError(errors, "primaryKeyword") ? <FieldError message={fieldError(errors, "primaryKeyword")!} /> : null}
          </Field>

          <Field>
            <Label htmlFor="secondaryKeywords">Secondary Keywords</Label>
            <input id="secondaryKeywords" value={formState.secondaryKeywords} onChange={(event) => setFormState((current) => ({ ...current, secondaryKeywords: event.target.value }))} placeholder="comma, separated, keywords" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-2 focus:ring-red-500" />
            {fieldError(errors, "secondaryKeywords") ? <FieldError message={fieldError(errors, "secondaryKeywords")!} /> : null}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="tone">Tone</Label>
            <input id="tone" value={formState.tone} onChange={(event) => setFormState((current) => ({ ...current, tone: event.target.value }))} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-2 focus:ring-red-500" />
            {fieldError(errors, "tone") ? <FieldError message={fieldError(errors, "tone")!} /> : null}
          </Field>

          <Field>
            <Label htmlFor="audience">Audience</Label>
            <input id="audience" value={formState.audience} onChange={(event) => setFormState((current) => ({ ...current, audience: event.target.value }))} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-2 focus:ring-red-500" />
            {fieldError(errors, "audience") ? <FieldError message={fieldError(errors, "audience")!} /> : null}
          </Field>
        </div>

        <Field>
          <Label htmlFor="callToAction">Call-to-Action</Label>
          <textarea id="callToAction" rows={3} value={formState.callToAction} onChange={(event) => setFormState((current) => ({ ...current, callToAction: event.target.value }))} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-2 focus:ring-red-500" />
          {fieldError(errors, "callToAction") ? <FieldError message={fieldError(errors, "callToAction")!} /> : null}
        </Field>

        <Field>
          <Label htmlFor="status">Status</Label>
          <select id="status" value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as "draft" | "publish" }))} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-red-500">
            <option value="draft">Draft</option>
            <option value="publish">Publish</option>
          </select>
          {fieldError(errors, "status") ? <FieldError message={fieldError(errors, "status")!} /> : null}
        </Field>

        {serverError ? <p className="rounded-2xl border border-rose-800/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">{serverError}</p> : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" disabled={isSubmitting} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white">
            Cancel
          </button>
        </div>
      </form>

      <aside className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <SectionHeader eyebrow="Preview" title="Request summary" description="The operator sees the exact request that will be sent to the page workflow." />
        <div className="mt-5 space-y-3 text-sm text-zinc-300">
          <SummaryRow label="Site" value={site.name} />
          <SummaryRow label="Title" value={formState.title || "Untitled"} />
          <SummaryRow label="Target slug" value={formState.targetSlug || "Not set"} />
          <SummaryRow label="Category" value={formState.category || "Uncategorized"} />
          <SummaryRow label="Primary keyword" value={formState.primaryKeyword || "Not set"} />
          <SummaryRow label="Secondary keywords" value={formState.secondaryKeywords || "Not set"} />
          <SummaryRow label="Word count" value={formState.wordCount || "Not set"} />
          <SummaryRow label="Tone" value={formState.tone || "Not set"} />
          <SummaryRow label="Audience" value={formState.audience || "Not set"} />
          <SummaryRow label="Call-to-action" value={formState.callToAction || "Not set"} />
          <SummaryRow label="Publishing status" value={formState.status} />
        </div>
      </aside>
    </div>
  );
}

function Field({ children }: { children: ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function Label({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-300">
      {children}
    </label>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="text-sm text-rose-300">{message}</p>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-sm text-white">{value}</p>
    </div>
  );
}
