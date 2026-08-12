"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { DataTable } from "./data-table";
import { EmptyState } from "./empty-state";
import { MetricCard } from "./metric-card";
import { SectionHeader } from "./section-header";
import { StatusBadge } from "./status-badge";
import { glwSites } from "@/lib/glw/sites";

type DailyPlanCandidate = {
  siteId: string;
  productId: string;
  productSlug: string;
  stateName: string;
  stateSlug: string;
  cityName?: string;
  citySlug?: string;
  canonicalPath: string;
  desiredAction: string;
  priority: number;
  reason: string;
  existingWordPressId?: string | number;
  existingStatus?: string;
  parentProductId?: string;
  parentStateId?: string;
};

type DailyPlan = {
  planId: string;
  siteId: string;
  generatedAt: string;
  status: string;
  limits: {
    dailyPageLimit: number;
    hourlyPageLimit: number;
    maxConcurrentJobs: number;
    retryLimit: number;
    productRotation: string[];
    stateRotation: string[];
    minimumDelaySeconds: number;
  };
  candidates: DailyPlanCandidate[];
  approved: DailyPlanCandidate[];
  blocked: DailyPlanCandidate[];
  summary: {
    totalCandidates: number;
    approvedCount: number;
    blockedCount: number;
    queuedToday: number;
    running: number;
    qaFailed: number;
    duplicates: number;
    missing: number;
  };
};

type PublishingControl = {
  siteId: string;
  paused: boolean;
  publishingEnabled: boolean;
  updatedAt: string;
};

type CoverageResponse = {
  control?: PublishingControl;
  plan?: DailyPlan;
  coverage?: {
    theoreticalTargets: number;
    existingPublished: number;
    existingDraft: number;
    missing: number;
    duplicates: number;
    wrongParent: number;
    qaFailed: number;
    coveragePercent: number;
  };
  error?: string;
};

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getVisibleCandidates(plan: DailyPlan | null, filter: { action: string; product: string; state: string; priority: string; site: string }): DailyPlanCandidate[] {
  if (!plan) {
    return [];
  }

  return plan.candidates.filter((candidate) => {
    if (filter.action && candidate.desiredAction !== filter.action) {
      return false;
    }

    if (filter.product && candidate.productId !== filter.product) {
      return false;
    }

    if (filter.state && candidate.stateSlug.toUpperCase() !== filter.state.toUpperCase()) {
      return false;
    }

    if (filter.priority === "high" && candidate.priority > 50) {
      return false;
    }

    if (filter.site && candidate.siteId !== filter.site) {
      return false;
    }

    return true;
  });
}

export function GlwNationalPlanningPanel() {
  const [siteId, setSiteId] = useState("led-display-warehouse");
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [coverage, setCoverage] = useState<CoverageResponse["coverage"] | null>(null);
  const [control, setControl] = useState<PublishingControl | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [showReviewTable, setShowReviewTable] = useState(true);
  const [isRefreshing, startTransition] = useTransition();

  const loadPlan = () => {
    startTransition(async () => {
      const params = new URLSearchParams({ siteId });
      const response = await fetch(`/api/glw/publishing-plans?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null) as CoverageResponse | null;

      if (!response.ok || !payload?.plan) {
        setError(payload?.error ?? "Unable to load the publishing plan.");
        return;
      }

      setPlan(payload.plan);
      setCoverage(payload.coverage ?? null);
      setControl(payload.control ?? null);
      setError(null);
    });
  };

  const generatePlan = () => {
    startTransition(async () => {
      const response = await fetch("/api/glw/publishing-plans", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      const payload = await response.json().catch(() => null) as CoverageResponse | null;

      if (!response.ok || !payload?.plan) {
        setError(payload?.error ?? "Unable to generate the publishing plan.");
        return;
      }

      setPlan(payload.plan);
      setCoverage(payload.coverage ?? null);
      setControl(payload.control ?? null);
      setError(null);
      setActionMessage(`Generated plan ${payload.plan.planId}`);
    });
  };

  const approvePlan = () => {
    if (!plan) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/glw/publishing-plans/${encodeURIComponent(plan.planId)}/approve`, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.planId }),
      });
      const payload = await response.json().catch(() => null) as CoverageResponse | null;

      if (!response.ok || !payload?.plan) {
        setError(payload?.error ?? "Unable to approve the plan.");
        return;
      }

      setPlan(payload.plan);
      setControl(payload.control ?? control);
      setActionMessage(`Approved ${payload.plan.approved.length} candidates.`);
      setError(null);
    });
  };

  const pausePublishing = () => {
    startTransition(async () => {
      const response = await fetch("/api/glw/publishing-control", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, action: "pause" }),
      });
      const payload = await response.json().catch(() => null) as CoverageResponse | null;
      if (!response.ok || !payload?.control) {
        setError(payload?.error ?? "Unable to pause publishing.");
        return;
      }
      setControl(payload.control);
      setActionMessage("Publishing paused.");
      setError(null);
    });
  };

  const resumePublishing = () => {
    startTransition(async () => {
      const response = await fetch("/api/glw/publishing-control", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, action: "resume" }),
      });
      const payload = await response.json().catch(() => null) as CoverageResponse | null;
      if (!response.ok || !payload?.control) {
        setError(payload?.error ?? "Unable to resume publishing.");
        return;
      }
      setControl(payload.control);
      setActionMessage("Publishing resumed.");
      setError(null);
    });
  };

  useEffect(() => {
    loadPlan();
  }, [siteId]);

  const visibleCandidates = useMemo(() => getVisibleCandidates(plan, {
    action: filterAction,
    product: filterProduct,
    state: filterState,
    priority: filterPriority,
    site: siteId,
  }), [plan, filterAction, filterProduct, filterState, filterPriority, siteId]);

  const planRows = visibleCandidates.map((candidate) => ({
    id: candidate.canonicalPath,
    action: candidate.desiredAction,
    product: candidate.productSlug,
    state: candidate.stateName,
    city: candidate.cityName ?? "--",
    path: candidate.canonicalPath,
    currentStatus: candidate.existingStatus ?? "--",
    priority: candidate.priority,
    reason: candidate.reason,
  }));

  const cards = plan ? [
    { label: "Coverage %", value: coverage ? formatPercent(coverage.coveragePercent) : "--", detail: "Theoretical vs current published coverage." },
    { label: "Published", value: coverage ? String(coverage.existingPublished) : "--", detail: "Published GLW pages detected." },
    { label: "Missing", value: coverage ? String(coverage.missing) : "--", detail: "Theoretical targets still missing." },
    { label: "Queued Today", value: String(plan.summary.queuedToday), detail: "Jobs already queued for the site." },
    { label: "Running", value: String(plan.summary.running), detail: "Jobs currently in progress." },
    { label: "QA Failed", value: String(plan.summary.qaFailed), detail: "Jobs requiring attention." },
    { label: "Duplicates", value: String(plan.summary.duplicates), detail: "Canonical target collisions." },
  ] : [];

  return (
    <section className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/[0.02] sm:p-6">
      <SectionHeader
        eyebrow="National Coverage"
        title="Publishing plan"
        description="Generate, review, and control the daily GLW publishing queue without modifying the frozen workflow."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              {glwSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}{site.publishingEnabled ? "" : " (disabled)"}
                </option>
              ))}
            </select>
            <button type="button" onClick={generatePlan} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50" disabled={isRefreshing}>
              Generate Daily Plan
            </button>
            <button type="button" onClick={() => setShowReviewTable((current) => !current)} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50">
              Review Plan
            </button>
            <button type="button" onClick={approvePlan} className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800" disabled={!plan || isRefreshing || !control?.publishingEnabled || control?.paused}>
              Approve Plan
            </button>
            <button type="button" onClick={pausePublishing} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50">
              Pause Publishing
            </button>
            <button type="button" onClick={resumePublishing} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50">
              Resume Publishing
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p className="uppercase tracking-[0.24em] text-zinc-400">Site Status</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{control?.publishingEnabled ? (control.paused ? "Paused" : "Ready") : "Disabled for publishing"}</p>
          <p className="mt-1 text-xs text-zinc-500">{control?.siteId ?? siteId}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p className="uppercase tracking-[0.24em] text-zinc-400">Plan Status</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{plan?.status ?? "No plan"}</p>
          <p className="mt-1 text-xs text-zinc-500">{plan?.planId ?? "Generate a plan to review candidates."}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p className="uppercase tracking-[0.24em] text-zinc-400">Queued Today</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{plan?.summary.queuedToday ?? 0}</p>
          <p className="mt-1 text-xs text-zinc-500">Existing job queue count for the selected site.</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p className="uppercase tracking-[0.24em] text-zinc-400">Limit</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{plan?.limits.dailyPageLimit ?? 25} / day</p>
          <p className="mt-1 text-xs text-zinc-500">{plan?.limits.hourlyPageLimit ?? 5} / hour, {plan?.limits.maxConcurrentJobs ?? 2} concurrent</p>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {actionMessage ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{actionMessage}</p> : null}

      {cards.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <MetricCard key={card.label} label={card.label} value={card.value} detail={card.detail} />
          ))}
        </section>
      ) : null}

      {showReviewTable ? (
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-950/[0.02]">
          <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap gap-2">
              <select value={filterProduct} onChange={(event) => setFilterProduct(event.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
                <option value="">All Products</option>
                {Array.from(new Set(plan?.candidates.map((candidate) => candidate.productId) ?? [])).map((productId) => (
                  <option key={productId} value={productId}>{productId}</option>
                ))}
              </select>
              <select value={filterState} onChange={(event) => setFilterState(event.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
                <option value="">All States</option>
                {Array.from(new Set(plan?.candidates.map((candidate) => candidate.stateSlug.toUpperCase()) ?? [])).map((stateCode) => (
                  <option key={stateCode} value={stateCode}>{stateCode}</option>
                ))}
              </select>
              <select value={filterAction} onChange={(event) => setFilterAction(event.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
                <option value="">All Actions</option>
                {["CREATE_STATE", "CREATE_CITY", "UPDATE_CITY", "SKIP_EXISTING", "BLOCKED_PARENT", "BLOCKED_DUPLICATE", "BLOCKED_QA", "BLOCKED_SITE"].map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
              <select value={filterPriority} onChange={(event) => setFilterPriority(event.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
                <option value="">All Priorities</option>
                <option value="high">High Priority</option>
              </select>
            </div>
            <p className="text-sm text-zinc-500">{visibleCandidates.length} candidates shown</p>
          </div>

          <DataTable
            rows={planRows}
            rowKey={(row) => row.id}
            emptyState={
              <div className="p-5 sm:p-6">
                <EmptyState title="No plan candidates" description="Generate a plan to inspect the coverage and queue candidates." />
              </div>
            }
            columns={[
              { header: "Action", className: "whitespace-nowrap", cell: (row) => <StatusBadge status={row.action.startsWith("BLOCKED") ? "failed" : row.action === "SKIP_EXISTING" ? "queued" : "succeeded"} /> },
              { header: "Product", className: "whitespace-nowrap text-zinc-600", cell: (row) => <span>{row.product}</span> },
              { header: "State", className: "whitespace-nowrap text-zinc-600", cell: (row) => <span>{row.state}</span> },
              { header: "City", className: "whitespace-nowrap text-zinc-600", cell: (row) => <span>{row.city}</span> },
              { header: "Canonical Path", className: "min-w-[20rem] text-zinc-600", cell: (row) => <span>{row.path}</span> },
              { header: "Current Status", className: "whitespace-nowrap text-zinc-600", cell: (row) => <span>{row.currentStatus}</span> },
              { header: "Priority", className: "whitespace-nowrap text-zinc-600", cell: (row) => <span>{row.priority}</span> },
              { header: "Reason", className: "min-w-[18rem] text-zinc-600", cell: (row) => <span>{row.reason}</span> },
            ]}
          />
        </section>
      ) : null}
    </section>
  );
}