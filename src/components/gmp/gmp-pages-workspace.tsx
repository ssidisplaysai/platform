"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { gmpPageTypes } from "@/lib/gmp/page-models";
import { GmpGovernanceTimeline } from "@/components/gmp/gmp-governance-timeline";
import { GmpReadinessSummary } from "@/components/gmp/gmp-readiness-summary";
import { GmpRelationshipHealth } from "@/components/gmp/gmp-relationship-health";
import { GmpLinkHealth } from "@/components/gmp/gmp-link-health";
import { GmpArchitectureSummary } from "@/components/gmp/gmp-architecture-summary";
import { GmpPageGraph } from "@/components/gmp/gmp-page-graph";
import { GmpSectionList } from "@/components/gmp/gmp-section-list";
import { GmpTraceabilityPanel } from "@/components/gmp/gmp-traceability-panel";
import { GmpVersionCompare } from "@/components/gmp/gmp-version-compare";
import { type GmpPageHealthReport } from "@/lib/gmp/page-health-contract";

type WorkspaceMode = "inventory" | "new" | "detail" | "brief" | "plan" | "sections" | "relationships" | "internal-links" | "readiness";

type PageRecord = {
  pageId: string;
  name: string;
  slug: string;
  pageType: string;
  siteId: string;
  lifecycleState: string;
  contentState: string;
  seoState: string;
  publishingState: string;
  priority: number;
  archivedAt?: string | null;
  updatedAt: string;
  currentBriefId?: string;
  currentContentPlanId?: string;
};

type PageInventoryPayload = {
  pages: PageRecord[];
  permissions?: PagePermissions;
};

type PageDetailPayload = {
  page: PageRecord & {
    canonicalUrl: string;
    title: string;
    workingTitle?: string;
    purpose?: string;
    primaryObjective?: string;
    locale: string;
    language: string;
    knowledgeWorkspaceVersion: number;
    brandProfileVersion: number;
  };
  briefs: Array<Record<string, unknown>>;
  plans: Array<Record<string, unknown>>;
  readiness?: Record<string, unknown> | null;
  relationships: Array<Record<string, unknown>>;
  internalLinks: Array<Record<string, unknown>>;
  permissions?: PagePermissions;
};

type PagePermissions = {
  canCreatePage: boolean;
  canEditPage: boolean;
  canArchivePage: boolean;
  canManageBrief: boolean;
  canManagePlan: boolean;
  canManageRelationships: boolean;
  canManageLinks: boolean;
  canReviewBriefOrPlan: boolean;
  canApproveBriefOrPlan: boolean;
  canRejectBriefOrPlan: boolean;
  canRunReadiness: boolean;
};

type PageBriefPayload = {
  brief: Record<string, unknown>;
  versions: Array<Record<string, unknown>>;
};

type PagePlanPayload = {
  plans: Array<Record<string, unknown>>;
  current?: Record<string, unknown> | null;
  sections: Array<Record<string, unknown>>;
  knowledgeReferences: Array<Record<string, unknown>>;
  sourceReferences: Array<Record<string, unknown>>;
  versions: Array<Record<string, unknown>>;
};

type PageReadinessPayload = {
  readiness?: Record<string, unknown> | null;
};

type PageHealthPayload = {
  graph: {
    parentTree: Record<string, string[]>;
    childTree: Record<string, string[]>;
    siblingGroups: Record<string, string[]>;
    clusterGroups: Record<string, string[]>;
    circularReferences: string[][];
    issues: Array<{ ruleId: string; severity: string; reason: string; suggestedResolution: string; affectedPageIds: string[] }>;
  };
  links: {
    inboundLinks: Record<string, string[]>;
    outboundLinks: Record<string, string[]>;
    linkHealthScore: number;
    issues: Array<{ ruleId: string; severity: string; reason: string; suggestedResolution: string }>;
  };
  report: GmpPageHealthReport;
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function valueText(value: unknown): string {
  if (Array.isArray(value)) return value.map(valueText).join(", ");
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function buildGovernanceEvents(input: {
  briefVersions: Array<Record<string, unknown>>;
  planVersions: Array<Record<string, unknown>>;
  readiness?: Record<string, unknown> | null;
  pageUpdatedAt?: string;
  brief?: Record<string, unknown> | null;
  plan?: Record<string, unknown> | null;
}): Array<{ label: string; at: string; detail?: string; state?: string }> {
  const events: Array<{ label: string; at: string; detail?: string; state?: string }> = [];

  for (const version of input.briefVersions) {
    const createdAt = typeof version.createdAt === "string" ? version.createdAt : undefined;
    if (!createdAt) continue;
    events.push({ label: "Brief Updated", at: createdAt, detail: typeof version.changeReason === "string" ? version.changeReason : "Brief version recorded", state: typeof version.changeReason === "string" ? version.changeReason : undefined });
  }

  for (const version of input.planVersions) {
    const createdAt = typeof version.createdAt === "string" ? version.createdAt : undefined;
    if (!createdAt) continue;
    events.push({ label: "Plan Updated", at: createdAt, detail: typeof version.changeReason === "string" ? version.changeReason : "Plan version recorded", state: typeof version.changeReason === "string" ? version.changeReason : undefined });
  }

  if (input.pageUpdatedAt) {
    events.push({ label: "Page Updated", at: input.pageUpdatedAt, detail: "Canonical page record updated" });
  }

  if (input.brief && typeof input.brief.approvedAt === "string") {
    events.push({ label: "Brief Approved", at: input.brief.approvedAt, detail: typeof input.brief.approvedBy === "string" ? `Approved by ${input.brief.approvedBy}` : undefined, state: typeof input.brief.status === "string" ? input.brief.status : undefined });
  }

  if (input.plan && typeof input.plan.approvedAt === "string") {
    events.push({ label: "Plan Approved", at: input.plan.approvedAt, detail: typeof input.plan.approvedBy === "string" ? `Approved by ${input.plan.approvedBy}` : undefined, state: typeof input.plan.status === "string" ? input.plan.status : undefined });
  }

  if (input.readiness && typeof input.readiness.createdAt === "string") {
    events.push({ label: "Readiness Run", at: input.readiness.createdAt, detail: `Score ${String(input.readiness.overallScore ?? 0)}%` });
  }

  return events;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </article>
  );
}

export function GmpPagesWorkspace({
  projectId,
  pageId,
  mode,
}: {
  projectId: string;
  pageId?: string;
  mode: WorkspaceMode;
}) {
  const [pages, setPages] = useState<PageRecord[]>([]);
  const [pageDetail, setPageDetail] = useState<PageDetailPayload | null>(null);
  const [briefPayload, setBriefPayload] = useState<PageBriefPayload | null>(null);
  const [planPayload, setPlanPayload] = useState<PagePlanPayload | null>(null);
  const [readinessPayload, setReadinessPayload] = useState<PageReadinessPayload | null>(null);
  const [healthPayload, setHealthPayload] = useState<PageHealthPayload | null>(null);
  const [permissions, setPermissions] = useState<PagePermissions | null>(null);
  const [selectedTab, setSelectedTab] = useState<WorkspaceMode>(mode);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [publishingFilter, setPublishingFilter] = useState("");

  const loadInventory = useCallback(async () => {
    const response = await fetch(`/api/gmp/projects/${projectId}/pages`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      setMessage("Unable to load pages.");
      setLoading(false);
      return;
    }

    const payload = await response.json() as PageInventoryPayload;
    setPages(payload.pages ?? []);
    setPermissions(payload.permissions ?? null);
    setLoading(false);
  }, [projectId]);

  const loadPage = useCallback(async () => {
    if (!pageId) {
      return;
    }

    const response = await fetch(`/api/gmp/pages/${pageId}`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      setMessage("Unable to load page detail.");
      return;
    }

    const payload = await response.json() as PageDetailPayload;
    setPageDetail(payload);
    setPermissions(payload.permissions ?? null);
  }, [pageId]);

  const loadBrief = useCallback(async () => {
    const currentBriefId = pageDetail?.page.currentBriefId;
    if (!currentBriefId) {
      setBriefPayload(null);
      return;
    }

    const response = await fetch(`/api/gmp/page-briefs/${currentBriefId}`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }

    setBriefPayload(await response.json() as PageBriefPayload);
  }, [pageDetail?.page.currentBriefId]);

  const loadPlan = useCallback(async () => {
    if (!pageId) {
      setPlanPayload(null);
      return;
    }

    const response = await fetch(`/api/gmp/pages/${pageId}/plans`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }

    setPlanPayload(await response.json() as PagePlanPayload);
  }, [pageId]);

  const loadReadiness = useCallback(async () => {
    if (!pageId) {
      setReadinessPayload(null);
      return;
    }

    const response = await fetch(`/api/gmp/pages/${pageId}/readiness`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }

    setReadinessPayload(await response.json() as PageReadinessPayload);
  }, [pageId]);

  const loadHealth = useCallback(async () => {
    if (!pageId) {
      setHealthPayload(null);
      return;
    }

    const response = await fetch(`/api/gmp/pages/${pageId}/health`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return;
    }

    setHealthPayload(await response.json() as PageHealthPayload);
  }, [pageId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await loadInventory();
      if (!active) return;
      if (pageId) {
        await loadPage();
      }
      if (!active) return;
      setLoading(false);
    })();
    return () => { active = false; };
  }, [loadInventory, loadPage, pageId, projectId]);

  useEffect(() => {
    if (!pageDetail) return;
    let active = true;
    const refreshRelatedState = async () => {
      if (!active) return;

      await loadBrief();
      await loadPlan();
      await loadReadiness();
      await loadHealth();
    };

    void refreshRelatedState();
    return () => { active = false; };
  }, [loadBrief, loadHealth, loadPage, loadPlan, loadReadiness, pageDetail, pageId]);

  const filteredPages = useMemo(() => pages.filter((page) => {
    const matchesSearch = !search || page.name.toLowerCase().includes(search.toLowerCase()) || page.slug.toLowerCase().includes(search.toLowerCase());
    const matchesSite = !siteFilter || page.siteId === siteFilter;
    const matchesType = !typeFilter || page.pageType === typeFilter;
    const matchesLifecycle = !lifecycleFilter || page.lifecycleState === lifecycleFilter;
    const matchesPublishing = !publishingFilter || page.publishingState === publishingFilter;
    return matchesSearch && matchesSite && matchesType && matchesLifecycle && matchesPublishing;
  }).sort((left, right) => right.priority - left.priority), [pages, search, siteFilter, typeFilter, lifecycleFilter, publishingFilter]);

  const canCreatePage = permissions?.canCreatePage ?? false;
  const canArchivePage = permissions?.canArchivePage ?? false;
  const canManageBrief = permissions?.canManageBrief ?? false;
  const canManagePlan = permissions?.canManagePlan ?? false;
  const canRunReadiness = permissions?.canRunReadiness ?? false;

  const currentBrief = briefPayload?.brief ?? pageDetail?.briefs?.[0] ?? null;
  const currentPlan = planPayload?.current ?? pageDetail?.plans?.[0] ?? null;
  const currentReadiness = readinessPayload?.readiness ?? pageDetail?.readiness ?? null;
  const currentBriefId = pageDetail?.page.currentBriefId ?? (typeof toRecord(currentBrief)?.briefId === "string" ? String(toRecord(currentBrief)?.briefId) : undefined);
  const currentPlanId = pageDetail?.page.currentContentPlanId ?? (typeof toRecord(currentPlan)?.contentPlanId === "string" ? String(toRecord(currentPlan)?.contentPlanId) : undefined);
  const timelineEvents = useMemo(() => buildGovernanceEvents({
    briefVersions: briefPayload?.versions ?? [],
    planVersions: planPayload?.versions ?? [],
    readiness: toRecord(currentReadiness),
    pageUpdatedAt: pageDetail?.page.updatedAt,
    brief: toRecord(currentBrief),
    plan: toRecord(currentPlan),
  }), [briefPayload?.versions, planPayload?.versions, currentReadiness, currentBrief, currentPlan, pageDetail?.page.updatedAt]);

  const briefVersions = briefPayload?.versions ?? [];
  const latestBriefVersion = briefVersions[briefVersions.length - 1];
  const previousBriefVersion = briefVersions[briefVersions.length - 2];
  const planVersions = planPayload?.versions ?? [];
  const latestPlanVersion = planVersions[planVersions.length - 1];
  const previousPlanVersion = planVersions[planVersions.length - 2];

  async function onCreatePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/gmp/projects/${projectId}/pages`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: form.get("siteId"),
        pageType: form.get("pageType"),
        name: form.get("name"),
        slug: form.get("slug"),
        title: form.get("title"),
        locale: form.get("locale"),
        language: form.get("language"),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setMessage(payload?.error ?? "Unable to create page.");
      return;
    }

    event.currentTarget.reset();
    await loadInventory();
    setMessage("Page created.");
  }

  async function onArchivePage(targetPageId: string) {
    if (!canArchivePage) {
      setMessage("Archive is not available for this session.");
      return;
    }
    const response = await fetch(`/api/gmp/pages/${targetPageId}`, { method: "DELETE", credentials: "include" }).catch(() => null);
    if (!response?.ok) {
      setMessage("Unable to archive page.");
      return;
    }
    await loadInventory();
    if (targetPageId === pageId) {
      await loadPage();
    }
  }

  async function onGeneratePlan() {
    if (!pageId) return;
    if (!canManagePlan) {
      setMessage("Plan generation is not available for this session.");
      return;
    }
    const response = await fetch(`/api/gmp/pages/${pageId}/plans/generate`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => null);
    if (!response?.ok) {
      setMessage("Unable to generate plan.");
      return;
    }
    await loadPage();
    await loadPlan();
  }

  async function onRunReadiness() {
    if (!pageId) return;
    if (!canRunReadiness) {
      setMessage("Readiness refresh is not available for this session.");
      return;
    }
    const response = await fetch(`/api/gmp/pages/${pageId}/readiness/run`, { method: "POST", credentials: "include" }).catch(() => null);
    if (!response?.ok) {
      setMessage("Unable to refresh readiness.");
      return;
    }
    await loadReadiness();
    setMessage("Readiness refreshed.");
  }

  async function onRunRelationshipScan() {
    if (!pageId) return;
    const response = await fetch(`/api/gmp/pages/${pageId}/relationships/scan`, { method: "POST", credentials: "include" }).catch(() => null);
    if (!response?.ok) {
      setMessage("Unable to refresh relationship health.");
      return;
    }
    await loadHealth();
  }

  async function onRunInternalLinkScan() {
    if (!pageId) return;
    const response = await fetch(`/api/gmp/pages/${pageId}/internal-links/scan`, { method: "POST", credentials: "include" }).catch(() => null);
    if (!response?.ok) {
      setMessage("Unable to refresh link health.");
      return;
    }
    await loadHealth();
  }

  async function onCreateBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pageId) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/gmp/pages/${pageId}/briefs`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose: form.get("purpose"),
        audience: form.get("audience"),
        userNeed: form.get("userNeed"),
        businessGoal: form.get("businessGoal"),
        primaryTopic: form.get("primaryTopic"),
        secondaryTopics: String(form.get("secondaryTopics") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        primaryKeyword: form.get("primaryKeyword"),
        secondaryKeywords: String(form.get("secondaryKeywords") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        searchIntent: form.get("searchIntent"),
        funnelStage: form.get("funnelStage"),
        valueProposition: form.get("valueProposition"),
        requiredClaims: String(form.get("requiredClaims") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        requiredProofPoints: String(form.get("requiredProofPoints") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        requiredProductsOrServices: String(form.get("requiredProductsOrServices") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        requiredApplications: String(form.get("requiredApplications") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        requiredIndustries: String(form.get("requiredIndustries") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        requiredTechnicalSpecifications: String(form.get("requiredTechnicalSpecifications") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        requiredFaqs: String(form.get("requiredFaqs") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        restrictedMessaging: String(form.get("restrictedMessaging") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        conversionGoal: form.get("conversionGoal"),
        primaryCta: form.get("primaryCta"),
        secondaryCta: form.get("secondaryCta"),
        competitorContext: {},
        toneGuidance: form.get("toneGuidance"),
        evidenceRequirements: String(form.get("evidenceRequirements") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        knowledgeRecordReferences: String(form.get("knowledgeRecordReferences") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        sourceReferences: String(form.get("sourceReferences") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setMessage("Unable to create brief.");
      return;
    }

    await loadPage();
    setMessage("Brief created.");
  }

  async function mutateBrief(action: "review" | "approve" | "reject" | "supersede") {
    if (!currentBriefId || !canManageBrief) {
      return;
    }

    const endpoint = action === "supersede"
      ? `/api/gmp/page-briefs/${currentBriefId}`
      : `/api/gmp/page-briefs/${currentBriefId}/${action}`;
    const response = await fetch(endpoint, {
      method: action === "supersede" ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "supersede" ? { supersede: true, changeReason: "Updated from workspace UI" } : { notes: "Updated from workspace UI" }),
    }).catch(() => null);

    if (!response?.ok) {
      setMessage(`Unable to ${action} brief.`);
      return;
    }

    await loadPage();
    await loadBrief();
    setMessage(`Brief ${action} succeeded.`);
  }

  async function mutatePlan(action: "review" | "approve" | "reject" | "supersede") {
    if (!currentPlanId || !canManagePlan) {
      return;
    }

    const endpoint = action === "supersede"
      ? `/api/gmp/content-plans/${currentPlanId}`
      : `/api/gmp/content-plans/${currentPlanId}/${action}`;
    const response = await fetch(endpoint, {
      method: action === "supersede" ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "supersede" ? { supersede: true, changeReason: "Updated from workspace UI" } : { notes: "Updated from workspace UI" }),
    }).catch(() => null);

    if (!response?.ok) {
      setMessage(`Unable to ${action} plan.`);
      return;
    }

    await loadPage();
    await loadPlan();
    setMessage(`Plan ${action} succeeded.`);
  }

  async function onGeneratePlanFromPage() {
    await onGeneratePlan();
  }

  if (loading) {
    return <div className="mx-auto w-full max-w-7xl px-4 text-sm text-zinc-400 sm:px-6 lg:px-8">Loading page workspace...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Canonical Page Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Project Pages</h1>
        <p className="mt-2 text-sm text-zinc-400">Manage canonical pages, briefs, plans, sections, relationships, internal links, and readiness without leaving the protected workspace.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedTab("inventory")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Inventory</button>
          {canCreatePage ? <button type="button" onClick={() => setSelectedTab("new")} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-950">Create Page</button> : null}
          {pageId ? (
            <>
              <button type="button" onClick={() => setSelectedTab("detail")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Overview</button>
              <button type="button" onClick={() => setSelectedTab("brief")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Brief</button>
              <button type="button" onClick={() => setSelectedTab("plan")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Plan</button>
              <button type="button" onClick={() => setSelectedTab("sections")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Sections</button>
              <button type="button" onClick={() => setSelectedTab("relationships")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Relationships</button>
              <button type="button" onClick={() => setSelectedTab("internal-links")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Internal Links</button>
              <button type="button" onClick={() => setSelectedTab("readiness")} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Readiness</button>
              <Link href={`/glw/projects/${projectId}/pages/${pageId}/content`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Content</Link>
            </>
          ) : null}
        </div>
      </section>

      {message ? <p className="text-sm text-amber-300">{message}</p> : null}

      {selectedTab === "inventory" || !pageId ? (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          {canCreatePage ? (
            <SectionCard title="Create Page">
            <form className="space-y-3" onSubmit={(event) => void onCreatePage(event)}>
              <input name="siteId" required placeholder="Site ID" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <div className="grid gap-2 sm:grid-cols-2">
                <select name="pageType" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                  {gmpPageTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <input name="priority" placeholder="Priority" defaultValue="50" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              </div>
              <input name="name" required placeholder="Page name" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="slug" placeholder="page-slug" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="title" required placeholder="Working title" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <div className="grid gap-2 sm:grid-cols-2">
                <input name="locale" placeholder="en-US" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                <input name="language" placeholder="en" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              </div>
              <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Create Page</button>
            </form>
            </SectionCard>
          ) : null}

          <SectionCard title="Page Inventory">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)} placeholder="Filter site" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} placeholder="Filter type" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input value={lifecycleFilter} onChange={(event) => setLifecycleFilter(event.target.value)} placeholder="Filter lifecycle" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input value={publishingFilter} onChange={(event) => setPublishingFilter(event.target.value)} placeholder="Filter publishing" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-zinc-200">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Slug</th>
                    <th className="pb-2 pr-4">Lifecycle</th>
                    <th className="pb-2 pr-4">Content</th>
                    <th className="pb-2 pr-4">SEO</th>
                    <th className="pb-2 pr-4">Publishing</th>
                    <th className="pb-2 pr-4">Priority</th>
                    <th className="pb-2 pr-4">Updated</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPages.map((page) => (
                    <tr key={page.pageId} className="border-t border-zinc-800">
                      <td className="py-2 pr-4 font-medium text-white">{page.name}</td>
                      <td className="py-2 pr-4">{page.pageType}</td>
                      <td className="py-2 pr-4 text-zinc-400">{page.slug}</td>
                      <td className="py-2 pr-4">{page.lifecycleState}</td>
                      <td className="py-2 pr-4">{page.contentState}</td>
                      <td className="py-2 pr-4">{page.seoState}</td>
                      <td className="py-2 pr-4">{page.publishingState}</td>
                      <td className="py-2 pr-4">{page.priority}</td>
                      <td className="py-2 pr-4 text-zinc-400">{formatTimestamp(page.updatedAt)}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <Link href={`/glw/projects/${projectId}/pages/${page.pageId}`} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-white">Open</Link>
                          {canArchivePage ? <button type="button" onClick={() => void onArchivePage(page.pageId)} className="rounded-lg border border-rose-700 px-2 py-1 text-xs text-rose-300">Archive</button> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </section>
      ) : null}

      {pageId && (selectedTab === "detail" || selectedTab === "brief" || selectedTab === "plan" || selectedTab === "sections" || selectedTab === "relationships" || selectedTab === "internal-links" || selectedTab === "readiness") ? (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title="Page Detail">
            {pageDetail ? (
              <div className="space-y-4 text-sm text-zinc-300">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Canonical Page</p>
                  <h3 className="text-2xl font-semibold text-white">{pageDetail.page.name}</h3>
                  <p className="text-zinc-400">{pageDetail.page.title}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div><span className="font-medium text-white">Site:</span> {pageDetail.page.siteId}</div>
                  <div><span className="font-medium text-white">Type:</span> {pageDetail.page.pageType}</div>
                  <div><span className="font-medium text-white">Lifecycle:</span> {pageDetail.page.lifecycleState}</div>
                  <div><span className="font-medium text-white">Content:</span> {pageDetail.page.contentState}</div>
                  <div><span className="font-medium text-white">SEO:</span> {pageDetail.page.seoState}</div>
                  <div><span className="font-medium text-white">Publishing:</span> {pageDetail.page.publishingState}</div>
                  <div><span className="font-medium text-white">Priority:</span> {pageDetail.page.priority}</div>
                  <div><span className="font-medium text-white">Locale:</span> {pageDetail.page.locale}</div>
                  <div><span className="font-medium text-white">Language:</span> {pageDetail.page.language}</div>
                </div>
                <p><span className="font-medium text-white">Canonical URL:</span> {pageDetail.page.canonicalUrl}</p>
                <p><span className="font-medium text-white">Current Brief:</span> {pageDetail.page.currentBriefId ?? "None"}</p>
                <p><span className="font-medium text-white">Current Content Plan:</span> {pageDetail.page.currentContentPlanId ?? "None"}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Readiness</p>
                    <p className="mt-1 text-lg text-white">{String(currentReadiness?.overallScore ?? 0)}%</p>
                    <p className="text-xs text-zinc-400">Blocking issues: {Array.isArray(currentReadiness?.blockingIssues) ? currentReadiness.blockingIssues.length : 0}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Traceability</p>
                    <p className="mt-1 text-lg text-white">{pageDetail.plans.length} plan(s)</p>
                    <p className="text-xs text-zinc-400">{pageDetail.briefs.length} brief(s) • {pageDetail.relationships.length} relationship(s)</p>
                  </div>
                </div>
              </div>
            ) : <p className="text-sm text-zinc-400">No page loaded.</p>}
          </SectionCard>

          {pageDetail ? (
            <div className="grid gap-6">
              <GmpTraceabilityPanel
                projectId={projectId}
                pageId={pageId}
                page={pageDetail.page}
                briefReferences={Array.isArray(toRecord(currentBrief)?.knowledgeRecordReferences) ? (toRecord(currentBrief)?.knowledgeRecordReferences as string[]).map((reference) => ({
                  knowledgeRecordId: String(reference),
                  knowledgeRecordVersion: typeof toRecord(currentBrief)?.briefVersion === "number" ? Number(toRecord(currentBrief)?.briefVersion) : undefined,
                  required: true,
                  role: "brief_reference",
                })) : []}
                planReferences={(planPayload?.knowledgeReferences ?? []).map((reference) => ({
                  knowledgeWorkspaceId: typeof reference.knowledgeWorkspaceId === "string" ? reference.knowledgeWorkspaceId : undefined,
                  knowledgeRecordId: typeof reference.knowledgeRecordId === "string" ? reference.knowledgeRecordId : undefined,
                  knowledgeRecordVersion: typeof reference.knowledgeRecordVersion === "number" ? reference.knowledgeRecordVersion : undefined,
                  required: typeof reference.required === "boolean" ? reference.required : undefined,
                  role: typeof reference.role === "string" ? reference.role : undefined,
                  metadata: toRecord(reference.metadata) ?? undefined,
                }))}
                sourceReferences={(planPayload?.sourceReferences ?? []).map((reference) => ({
                  sourceId: typeof reference.sourceId === "string" ? reference.sourceId : undefined,
                  required: typeof reference.required === "boolean" ? reference.required : undefined,
                  role: typeof reference.role === "string" ? reference.role : undefined,
                }))}
                sections={(planPayload?.sections ?? []).map((section) => ({
                  sectionId: typeof section.sectionId === "string" ? section.sectionId : undefined,
                  sectionKey: typeof section.sectionKey === "string" ? section.sectionKey : undefined,
                  workingHeading: typeof section.workingHeading === "string" ? section.workingHeading : undefined,
                  position: typeof section.position === "number" ? section.position : undefined,
                  requiredKnowledgeRecords: Array.isArray(section.requiredKnowledgeRecords) ? section.requiredKnowledgeRecords.map(String) : [],
                  requiredEvidence: Array.isArray(section.requiredEvidence) ? section.requiredEvidence.map(String) : [],
                }))}
              />

              <GmpGovernanceTimeline title="Page governance events" events={timelineEvents} />

              {healthPayload ? (
                <div className="grid gap-6 xl:grid-cols-2">
                  <GmpPageGraph
                    parentTree={healthPayload.graph.parentTree}
                    childTree={healthPayload.graph.childTree}
                    siblingGroups={healthPayload.graph.siblingGroups}
                    clusterGroups={healthPayload.graph.clusterGroups}
                    circularReferences={healthPayload.graph.circularReferences}
                  />
                  <GmpRelationshipHealth health={healthPayload.report.relationshipHealth} issues={healthPayload.graph.issues} />
                  <GmpLinkHealth score={healthPayload.report.linkHealthScore} inboundLinks={healthPayload.links.inboundLinks} outboundLinks={healthPayload.links.outboundLinks} issues={healthPayload.links.issues} />
                  <GmpArchitectureSummary
                    pagesReady={healthPayload.report.pagesReady}
                    pagesBlocked={healthPayload.report.pagesBlocked}
                    missingBriefs={healthPayload.report.missingBriefs}
                    missingPlans={healthPayload.report.missingPlans}
                    missingSections={healthPayload.report.missingSections}
                    averageReadiness={healthPayload.report.averageReadiness}
                    relationshipHealth={healthPayload.report.relationshipHealth.score}
                    linkHealth={healthPayload.report.linkHealth.score}
                    orphanPages={healthPayload.report.orphanPages}
                    duplicateCanonicals={healthPayload.report.duplicateCanonicals}
                    latestExecutions={healthPayload.report.latestGopExecutions}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-6">
            {selectedTab === "brief" ? (
              <SectionCard title="Page Brief Editor">
                {latestBriefVersion ? (
                  <div className="mb-4">
                    <GmpVersionCompare
                      title="Brief change comparison"
                      before={toRecord(previousBriefVersion?.newValue ?? previousBriefVersion?.previousValue)}
                      after={toRecord(latestBriefVersion.newValue)}
                      beforeLabel="Prior version"
                      afterLabel="Latest version"
                    />
                  </div>
                ) : null}
                <form className="grid gap-3" onSubmit={(event) => void onCreateBrief(event)}>
                  <input name="purpose" placeholder="Purpose" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <input name="audience" placeholder="Audience" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <input name="userNeed" placeholder="User need" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <input name="businessGoal" placeholder="Business goal" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <div className="grid gap-2 sm:grid-cols-2"><input name="primaryTopic" placeholder="Primary topic" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" /><input name="primaryKeyword" placeholder="Primary keyword" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" /></div>
                  <textarea name="secondaryTopics" placeholder="Secondary topics comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="secondaryKeywords" placeholder="Secondary keywords comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <input name="searchIntent" placeholder="Search intent" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <input name="funnelStage" placeholder="Funnel stage" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="valueProposition" placeholder="Value proposition" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="requiredClaims" placeholder="Required claims comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="requiredProofPoints" placeholder="Required proof points comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="requiredProductsOrServices" placeholder="Products or services comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="requiredApplications" placeholder="Applications comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="requiredIndustries" placeholder="Industries comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="requiredTechnicalSpecifications" placeholder="Technical specifications comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="requiredFaqs" placeholder="FAQs comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="restrictedMessaging" placeholder="Restricted messaging comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <div className="grid gap-2 sm:grid-cols-2"><input name="conversionGoal" placeholder="Conversion goal" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" /><input name="primaryCta" placeholder="Primary CTA" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" /></div>
                  <input name="secondaryCta" placeholder="Secondary CTA" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="toneGuidance" placeholder="Tone guidance" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="evidenceRequirements" placeholder="Evidence requirements comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="knowledgeRecordReferences" placeholder="Knowledge references comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <textarea name="sourceReferences" placeholder="Source references comma separated" rows={2} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Create Brief</button>
                </form>
                <div className="mt-4 space-y-2 text-sm text-zinc-300">
                  <p><span className="font-medium text-white">Current Brief:</span> {currentBrief ? valueText(currentBrief) : "None"}</p>
                  <p><span className="font-medium text-white">Version history:</span> {briefPayload?.versions?.length ?? 0}</p>
                </div>
                {canManageBrief ? (
                  <div className="mt-4 space-y-3">
                    <button type="button" onClick={() => void mutateBrief("review")} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Submit for Review</button>
                    <button type="button" onClick={() => void mutateBrief("approve")} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white">Approve</button>
                    <button type="button" onClick={() => void mutateBrief("reject")} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white">Reject</button>
                    <button type="button" onClick={() => void mutateBrief("supersede")} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white">Supersede Approved Brief</button>
                  </div>
                ) : null}
              </SectionCard>
            ) : null}

            {selectedTab === "plan" ? (
              <SectionCard title="Content Plan Viewer">
                {latestPlanVersion ? (
                  <div className="mb-4">
                    <GmpVersionCompare
                      title="Plan change comparison"
                      before={toRecord(previousPlanVersion?.newValue ?? previousPlanVersion?.previousValue)}
                      after={toRecord(latestPlanVersion.newValue)}
                      beforeLabel="Prior version"
                      afterLabel="Latest version"
                    />
                  </div>
                ) : null}
                <div className="space-y-3 text-sm text-zinc-300">
                  {canManagePlan ? <button type="button" onClick={() => void onGeneratePlanFromPage()} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Generate Plan</button> : null}
                  <div><span className="font-medium text-white">Plan:</span> {currentPlan ? valueText(currentPlan) : "None"}</div>
                  <div><span className="font-medium text-white">Sections:</span> {planPayload?.sections?.length ?? 0}</div>
                  <div><span className="font-medium text-white">Knowledge refs:</span> {planPayload?.knowledgeReferences?.length ?? 0}</div>
                  <div><span className="font-medium text-white">Source refs:</span> {planPayload?.sourceReferences?.length ?? 0}</div>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Planning model {currentPlan && typeof currentPlan === "object" ? valueText((currentPlan as Record<string, unknown>).planningModelVersion) : "n/a"}</p>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Knowledge workspace version {pageDetail?.page.knowledgeWorkspaceVersion ?? 0}</p>
                </div>
                {canManagePlan ? (
                  <div className="mt-4 space-y-2 text-sm text-zinc-300">
                    <button type="button" onClick={() => void mutatePlan("review")} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white">Submit for Review</button>
                    <button type="button" onClick={() => void mutatePlan("approve")} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white">Approve</button>
                    <button type="button" onClick={() => void mutatePlan("reject")} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white">Reject</button>
                    <button type="button" onClick={() => void mutatePlan("supersede")} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white">Supersede Plan</button>
                  </div>
                ) : null}
              </SectionCard>
            ) : null}

            {selectedTab === "sections" ? (
              <SectionCard title="Section Planner">
                <GmpSectionList
                  sections={(planPayload?.sections ?? []).map((section) => ({
                    sectionId: String(section.sectionId ?? ""),
                    sectionKey: String(section.sectionKey ?? ""),
                    sectionType: String(section.sectionType ?? ""),
                    position: Number(section.position ?? 0),
                    workingHeading: typeof section.workingHeading === "string" ? section.workingHeading : undefined,
                    optional: Boolean(section.optional),
                    status: typeof section.status === "string" ? section.status : undefined,
                    targetWordRange: toRecord(section.targetWordRange) ? { min: Number(toRecord(section.targetWordRange)?.min ?? 0), max: Number(toRecord(section.targetWordRange)?.max ?? 0) } : undefined,
                    ctaType: typeof section.ctaType === "string" ? section.ctaType : undefined,
                    mediaRequirement: toRecord(section.mediaRequirement) ?? undefined,
                    internalLinkRequirement: toRecord(section.internalLinkRequirement) ?? undefined,
                    structuredDataContribution: toRecord(section.structuredDataContribution) ?? undefined,
                    requiredKnowledgeRecords: Array.isArray(section.requiredKnowledgeRecords) ? section.requiredKnowledgeRecords.map(String) : [],
                    requiredClaims: Array.isArray(section.requiredClaims) ? section.requiredClaims.map(String) : [],
                    requiredEvidence: Array.isArray(section.requiredEvidence) ? section.requiredEvidence.map(String) : [],
                  }))}
                  canManagePlan={canManagePlan}
                  onReorder={async (orderedSectionIds) => {
                    if (!pageDetail?.page.currentContentPlanId) {
                      return;
                    }
                    const response = await fetch(`/api/gmp/content-plans/${pageDetail.page.currentContentPlanId}/sections/reorder`, {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ orderedSectionIds }),
                    }).catch(() => null);
                    if (response?.ok) {
                      await loadPage();
                      await loadPlan();
                    }
                  }}
                />
              </SectionCard>
            ) : null}

            {selectedTab === "relationships" ? (
              <SectionCard title="Relationship Management">
                <div className="space-y-4 text-sm text-zinc-300">
                  {healthPayload ? (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Relationship Health</p>
                          <p className="mt-1 text-3xl font-semibold text-white">{healthPayload.report.relationshipHealth.score}%</p>
                        </div>
                        <button type="button" onClick={() => void onRunRelationshipScan()} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Rerun scan</button>
                      </div>
                      <p className="mt-2 text-xs text-zinc-400">{healthPayload.report.reportVersion} • {healthPayload.report.graphModelVersion} • {formatTimestamp(healthPayload.report.generatedAt)}</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Parent Groups</p><p className="mt-1 text-lg font-semibold text-white">{Object.keys(healthPayload.report.diagnostics.graph.parentTree).length}</p></article>
                        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Child Groups</p><p className="mt-1 text-lg font-semibold text-white">{Object.keys(healthPayload.report.diagnostics.graph.childTree).length}</p></article>
                        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Cluster Groups</p><p className="mt-1 text-lg font-semibold text-white">{Object.keys(healthPayload.report.diagnostics.graph.clusterGroups).length}</p></article>
                        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Disconnected</p><p className="mt-1 text-lg font-semibold text-white">{healthPayload.report.disconnectedPages}</p></article>
                      </div>
                      <div className="mt-4 space-y-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Blocking Issues</p>
                        {(healthPayload.report.relationshipHealth.blockingIssues.length > 0 ? healthPayload.report.relationshipHealth.blockingIssues : ["None"]).map((item) => <p key={item} className="text-zinc-300">{item}</p>)}
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Warnings</p>
                        {(healthPayload.report.relationshipHealth.warnings.length > 0 ? healthPayload.report.relationshipHealth.warnings : ["None"]).map((item) => <p key={item} className="text-zinc-300">{item}</p>)}
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Recommendations</p>
                        {(healthPayload.report.relationshipHealth.recommendations.length > 0 ? healthPayload.report.relationshipHealth.recommendations : ["None"]).map((item) => <p key={item} className="text-zinc-300">{item}</p>)}
                      </div>
                      <div className="mt-4 space-y-2">
                        {healthPayload.report.diagnostics.relationshipIssues.map((issue) => (
                          <div key={`${issue.ruleId}-${issue.reason}`} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                            <p className="font-medium text-white">{issue.ruleId} • {issue.severity}</p>
                            <p className="text-zinc-400">{issue.reason}</p>
                            <p className="text-zinc-500">{issue.suggestedResolution}</p>
                            <p className="mt-1 text-xs text-zinc-500">Affected pages: {issue.affectedPageIds?.length ? issue.affectedPageIds.join(", ") : "None"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    {(pageDetail?.relationships ?? []).map((relationship, index) => (
                      <div key={String(relationship.relationshipId ?? index)} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <p className="font-medium text-white">{valueText(relationship.relationshipType)}</p>
                        <p className="text-xs text-zinc-400">{valueText(relationship.sourcePageId)} → {valueText(relationship.targetPageId)} • {valueText(relationship.priority)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {selectedTab === "internal-links" ? (
              <SectionCard title="Internal-Link Planning">
                <div className="space-y-4 text-sm text-zinc-300">
                  {healthPayload ? (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Link Health</p>
                          <p className="mt-1 text-3xl font-semibold text-white">{healthPayload.report.linkHealth.score}%</p>
                        </div>
                        <button type="button" onClick={() => void onRunInternalLinkScan()} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white">Rerun scan</button>
                      </div>
                      <p className="mt-2 text-xs text-zinc-400">{healthPayload.report.reportVersion} • {healthPayload.report.linkModelVersion} • {formatTimestamp(healthPayload.report.generatedAt)}</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Inbound Count</p><p className="mt-1 text-lg font-semibold text-white">{Object.values(healthPayload.report.diagnostics.links.inboundLinks).flat().length}</p></article>
                        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Outbound Count</p><p className="mt-1 text-lg font-semibold text-white">{Object.values(healthPayload.report.diagnostics.links.outboundLinks).flat().length}</p></article>
                        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Missing Required</p><p className="mt-1 text-lg font-semibold text-white">{healthPayload.report.missingInternalLinks}</p></article>
                        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Broken Targets</p><p className="mt-1 text-lg font-semibold text-white">{healthPayload.report.brokenPlannedLinks}</p></article>
                        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Orphans</p><p className="mt-1 text-lg font-semibold text-white">{healthPayload.report.orphanPages}</p></article>
                        <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Weak Clusters</p><p className="mt-1 text-lg font-semibold text-white">{healthPayload.report.weakClusters}</p></article>
                      </div>
                      <div className="mt-4 space-y-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Blocking Issues</p>
                        {(healthPayload.report.linkHealth.blockingIssues.length > 0 ? healthPayload.report.linkHealth.blockingIssues : ["None"]).map((item) => <p key={item} className="text-zinc-300">{item}</p>)}
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Warnings</p>
                        {(healthPayload.report.linkHealth.warnings.length > 0 ? healthPayload.report.linkHealth.warnings : ["None"]).map((item) => <p key={item} className="text-zinc-300">{item}</p>)}
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Recommendations</p>
                        {(healthPayload.report.linkHealth.recommendations.length > 0 ? healthPayload.report.linkHealth.recommendations : ["None"]).map((item) => <p key={item} className="text-zinc-300">{item}</p>)}
                      </div>
                      <div className="mt-4 space-y-2">
                        {healthPayload.report.diagnostics.linkIssues.map((issue) => (
                          <div key={`${issue.ruleId}-${issue.reason}`} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                            <p className="font-medium text-white">{issue.ruleId} • {issue.severity}</p>
                            <p className="text-zinc-400">{issue.reason}</p>
                            <p className="text-zinc-500">{issue.suggestedResolution}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    {(pageDetail?.internalLinks ?? []).map((link, index) => (
                      <div key={String(link.internalLinkPlanId ?? index)} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <p className="font-medium text-white">{valueText(link.linkPurpose)}</p>
                        <p className="text-xs text-zinc-400">{valueText(link.sourcePageId)} → {valueText(link.targetPageId)} • {valueText(link.requirementLevel)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {selectedTab === "readiness" ? (
              <SectionCard title="Page Readiness">
                <GmpReadinessSummary readiness={toRecord(currentReadiness) as never} canRunReadiness={canRunReadiness} onRunReadiness={() => void onRunReadiness()} />
              </SectionCard>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
