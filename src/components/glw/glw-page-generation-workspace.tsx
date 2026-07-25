"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "./empty-state";
import { DataTable } from "./data-table";
import { PageContainer } from "./page-container";
import { SectionHeader } from "./section-header";
import { StatusBadge } from "./status-badge";
import type { GlwJobRecord } from "@/lib/glw/jobs";
import { glwSites, type GlwSite } from "@/lib/glw/sites";
import { GlwJobPanel } from "./glw-job-panel";

type GlwPageGenerationWorkspaceProps = {
  initialJobs: GlwJobRecord[];
  initialSelectedJob: GlwJobRecord | null;
  initialSiteId?: string;
};

type GenerationFormState = {
  siteId: string;
  product: string;
  category: string;
  state: string;
  city: string;
  primaryKeyword: string;
  additionalInstructions: string;
  publishingMode: "draft" | "publish";
};

type FieldErrors = Partial<Record<keyof GenerationFormState, string>>;

const initialFormState: GenerationFormState = {
  siteId: "led-display-warehouse",
  product: "LED Wall Rental Package",
  category: "Rentals",
  state: "",
  city: "",
  primaryKeyword: "LED wall rental",
  additionalInstructions: "Focus on a confident, concise offer with an operator-friendly CTA.",
  publishingMode: "draft",
};

function createFormData(formState: GenerationFormState): FormData {
  const formData = new FormData();

  formData.set("siteId", formState.siteId);
  formData.set("product", formState.product);
  formData.set("category", formState.category);
  formData.set("state", formState.state);
  formData.set("city", formState.city);
  formData.set("primaryKeyword", formState.primaryKeyword);
  formData.set("additionalInstructions", formState.additionalInstructions);
  formData.set("publishingMode", formState.publishingMode);

  return formData;
}

function validateForm(formState: GenerationFormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!formState.siteId.trim()) errors.siteId = "Site is required.";
  if (!formState.product.trim()) errors.product = "Product is required.";
  if (!formState.category.trim()) errors.category = "Category is required.";
  if (!formState.primaryKeyword.trim()) errors.primaryKeyword = "Primary keyword is required.";
  if (!formState.publishingMode.trim()) errors.publishingMode = "Publishing mode is required.";

  return errors;
}

function fieldError(errors: FieldErrors, key: keyof GenerationFormState): string | undefined {
  return errors[key];
}

function getJobStatusLabel(job: GlwJobRecord): "queued" | "running" | "succeeded" | "failed" {
  if (job.status === "FAILED") return "failed";
  if (job.status === "COMPLETE") return "succeeded";
  if (job.status === "QUEUED") return "queued";
  return "running";
}

export function GlwPageGenerationWorkspace({ initialJobs, initialSelectedJob, initialSiteId }: GlwPageGenerationWorkspaceProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<GlwJobRecord | null>(initialSelectedJob);
  const [jobs, setJobs] = useState<GlwJobRecord[]>(initialJobs);
  const [formState, setFormState] = useState<GenerationFormState>({
    ...initialFormState,
    siteId: initialSiteId ?? initialFormState.siteId,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  const selectedSite = useMemo(() => glwSites.find((site) => site.id === formState.siteId) ?? glwSites[0], [formState.siteId]);

  const openGenerator = () => {
    setServerError(null);
    setErrors({});
    setIsDialogOpen(true);
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
    setIsDialogOpen(false);
    router.refresh();
  };

  const handleSubmit = () => {
    startTransition(() => {
      void createJob();
    });
  };

  const refreshJob = async (jobId: string): Promise<GlwJobRecord> => {
    try {
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
    } finally {
    }
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

  const recentRows = jobs.map((job) => ({
    id: job.id,
    status: getJobStatusLabel(job),
    title: job.title,
    site: job.input.site.name,
    location: [job.input.page.city, job.input.page.state].filter(Boolean).join(", ") || "Unspecified",
    created: new Date(job.createdAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    duration: formatDuration(job),
    actionLabel: job.status === "FAILED" ? "Retry" : job.status === "COMPLETE" ? "Open" : "View",
  }));

  return (
    <PageContainer className="space-y-6 sm:space-y-8">
      <SectionHeader
        eyebrow="Pages"
        title="Pages"
        description="Generate production pages, track workflow execution, and keep the operator focused on the current job state."
        actions={
          <button
            type="button"
            onClick={openGenerator}
            className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Generate Page
          </button>
        }
      />

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-950/[0.02]">
        <div className="border-b border-zinc-200 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Recent page-generation jobs</h2>
              <p className="mt-1 text-sm text-zinc-500">Current and recent GLW jobs are tracked in the database and refreshed from the server.</p>
            </div>
            <p className="text-sm text-zinc-500">{recentRows.length} jobs</p>
          </div>
        </div>

        <DataTable
          rows={recentRows}
          rowKey={(row) => row.id}
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
              className: "whitespace-nowrap",
              cell: (row) => <StatusBadge status={row.status} />,
            },
            {
              header: "Page Title",
              className: "min-w-[22rem]",
              cell: (row) => (
                <div className="space-y-1">
                  <p className="font-medium text-zinc-950">{row.title}</p>
                  <p className="text-xs text-zinc-500">{row.id}</p>
                </div>
              ),
            },
            {
              header: "Site",
              className: "whitespace-nowrap text-zinc-600",
              cell: (row) => <span>{row.site}</span>,
            },
            {
              header: "Location",
              className: "whitespace-nowrap text-zinc-600",
              cell: (row) => <span>{row.location}</span>,
            },
            {
              header: "Created",
              className: "whitespace-nowrap text-zinc-600",
              cell: (row) => <span>{row.created}</span>,
            },
            {
              header: "Duration",
              className: "whitespace-nowrap text-zinc-600",
              cell: (row) => <span className="font-medium text-zinc-700">{row.duration}</span>,
            },
            {
              header: "Result",
              className: "whitespace-nowrap text-right",
              cell: (row) => (
                <button
                  type="button"
                  onClick={() => {
                    void refreshJob(row.id);
                    setIsDialogOpen(false);
                  }}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  Open
                </button>
              ),
            },
          ]}
        />
      </section>

      <GlwJobPanel
        key={selectedJob?.id ?? "empty"}
        job={selectedJob}
        onRetry={retryJob}
        onGenerateAnother={openGenerator}
      />

      {isDialogOpen ? (
        <GeneratorDialog
          formState={formState}
          setFormState={setFormState}
          errors={errors}
          serverError={serverError}
          isSubmitting={isSubmitting}
          onClose={() => setIsDialogOpen(false)}
          onSubmit={() => handleSubmit()}
          site={selectedSite}
        />
      ) : null}
    </PageContainer>
  );
}

function formatDuration(job: GlwJobRecord): string {
  if (!job.startedAt) {
    return "--";
  }

  const startedAt = new Date(job.startedAt).getTime();
  const endedAt = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function GeneratorDialog({
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
  setFormState: React.Dispatch<React.SetStateAction<GenerationFormState>>;
  errors: FieldErrors;
  serverError: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  site: GlwSite;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-4 sm:items-center">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-950/20">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-400">Generate Page</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">Create a page-generation job</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950">
            Close
          </button>
        </div>

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
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400"
              >
                {glwSites.map((glwSite) => (
                  <option key={glwSite.id} value={glwSite.id}>{glwSite.name}</option>
                ))}
              </select>
              {fieldError(errors, "siteId") ? <FieldError message={fieldError(errors, "siteId")!} /> : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label htmlFor="product">Product</Label>
                <input id="product" value={formState.product} onChange={(event) => setFormState((current) => ({ ...current, product: event.target.value }))} className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400" />
                {fieldError(errors, "product") ? <FieldError message={fieldError(errors, "product")!} /> : null}
              </Field>

              <Field>
                <Label htmlFor="category">Category</Label>
                <input id="category" value={formState.category} onChange={(event) => setFormState((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400" />
                {fieldError(errors, "category") ? <FieldError message={fieldError(errors, "category")!} /> : null}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label htmlFor="state">State</Label>
                <input id="state" value={formState.state} onChange={(event) => setFormState((current) => ({ ...current, state: event.target.value }))} placeholder="California" className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400" />
              </Field>
              <Field>
                <Label htmlFor="city">City</Label>
                <input id="city" value={formState.city} onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))} placeholder="Los Angeles" className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400" />
              </Field>
            </div>

            <Field>
              <Label htmlFor="primaryKeyword">Primary Keyword</Label>
              <input id="primaryKeyword" value={formState.primaryKeyword} onChange={(event) => setFormState((current) => ({ ...current, primaryKeyword: event.target.value }))} className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400" />
              {fieldError(errors, "primaryKeyword") ? <FieldError message={fieldError(errors, "primaryKeyword")!} /> : null}
            </Field>

            <Field>
              <Label htmlFor="additionalInstructions">Additional Instructions</Label>
              <textarea id="additionalInstructions" rows={4} value={formState.additionalInstructions} onChange={(event) => setFormState((current) => ({ ...current, additionalInstructions: event.target.value }))} className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400" />
            </Field>

            <Field>
              <Label htmlFor="publishingMode">Publishing Mode</Label>
              <select id="publishingMode" value={formState.publishingMode} onChange={(event) => setFormState((current) => ({ ...current, publishingMode: event.target.value as "draft" | "publish" }))} className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400">
                <option value="draft">Draft</option>
                <option value="publish">Publish</option>
              </select>
              {fieldError(errors, "publishingMode") ? <FieldError message={fieldError(errors, "publishingMode")!} /> : null}
            </Field>

            {serverError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{serverError}</p> : null}

            <div className="flex flex-wrap gap-3 pt-2">
              <button type="submit" disabled={isSubmitting} className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </button>
              <button type="button" onClick={onClose} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50">
                Cancel
              </button>
            </div>
          </form>

          <aside className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <SectionHeader eyebrow="Preview" title="Request summary" description="The operator sees the exact request that will be sent to the page workflow." />
            <div className="mt-5 space-y-3 text-sm text-zinc-600">
              <SummaryRow label="Site" value={site.name} />
              <SummaryRow label="Product" value={formState.product || "Untitled"} />
              <SummaryRow label="Category" value={formState.category || "Uncategorized"} />
              <SummaryRow label="Primary keyword" value={formState.primaryKeyword || "Not set"} />
              <SummaryRow label="Publishing mode" value={formState.publishingMode} />
              <SummaryRow label="Additional instructions" value={formState.additionalInstructions || "None"} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-700">
      {children}
    </label>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="text-sm text-rose-700">{message}</p>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-400">{label}</p>
      <p className="mt-2 break-words text-sm text-zinc-950">{value}</p>
    </div>
  );
}
