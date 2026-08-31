"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GLW_STATES,
  buildLocalGlwGenerationPreview,
  createDefaultGlwGenerationInput,
  getGlwCitiesForState,
  type GlwGenerationProduct,
  type GlwGenerationRequestInput,
  type GlwGenerationSite,
  type GlwLocalPlannedOperation,
  type GlwLocalGenerationPreview,
  type GlwPageType,
  type GlwPublicationIntent,
} from "./page-generation";
import type { GlwPageExecutionRecord } from "./page-execution";
import type {
  GlwTargetMutationAvailability,
  GlwTargetPreflightResult,
} from "./target-preflight";

type Props = {
  sites: readonly GlwGenerationSite[];
  products: readonly GlwGenerationProduct[];
  canPrepareRequest: boolean;
  executionConfigured: boolean;
  executionWorkflowName: string;
  requestRoles: readonly string[];
  organizationId: string;
};

type TargetPreflightResponse = {
  target?: GlwTargetPreflightResult;
  availability?: GlwTargetMutationAvailability;
  error?: string;
};

function firstProductForSite(
  products: readonly GlwGenerationProduct[],
  siteId: string,
): GlwGenerationProduct | null {
  return products.find((product) => product.siteId === siteId) ?? null;
}

type SiteDiscoveryCandidate = {
  wordpressPageId: number;
  title: string;
  slug: string;
  sourceUrl: string;
  status: string;
  classification: "product_or_service" | "possible_product_or_service";
  confidence: "high" | "medium";
  evidence: readonly string[];
};

type DiscoveryCategoryOption = {
  categoryId: string;
  organizationId: string;
  name: string;
  status: string;
  siteAssignments: readonly string[];
};

type SiteDiscoverySuccess = {
  ok: true;
  siteId: string;
  siteName: string;
  scannedPageCount: number;
  candidateCount: number;
  candidates: readonly SiteDiscoveryCandidate[];
  truncated: boolean;
  discoveredAt: string;
};

type SiteDiscoveryFailure = {
  ok: false;
  siteId: string;
  message: string;
  reason: string;
  discoveredAt: string;
};

type SiteDiscoveryResult =
  | SiteDiscoverySuccess
  | SiteDiscoveryFailure;
export function GlwPageGenerationWorkspace({
  sites,
  products,
  canPrepareRequest,
  executionConfigured,
  executionWorkflowName,
  requestRoles,
  organizationId,
}: Props) {
  const initialSite = sites[0] ?? null;
  const initialProduct = initialSite
    ? firstProductForSite(products, initialSite.siteId)
    : null;
  const [form, setForm] = useState<GlwGenerationRequestInput | null>(() =>
    initialSite && initialProduct
      ? createDefaultGlwGenerationInput(initialSite, initialProduct)
      : null,
  );
  const [preview, setPreview] = useState<GlwLocalGenerationPreview | null>(null);
  const [execution, setExecution] = useState<GlwPageExecutionRecord | null>(null);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [targetPreflight, setTargetPreflight] = useState<TargetPreflightResponse | null>(null);
  const [targetPreflightLoading, setTargetPreflightLoading] = useState(true);
  const [siteDiscovery, setSiteDiscovery] =
    useState<SiteDiscoveryResult | null>(null);
  const [siteDiscoveryLoading, setSiteDiscoveryLoading] =
    useState(false);
  const [selectedDiscoveryIds, setSelectedDiscoveryIds] =
    useState<Set<number>>(() => new Set());
  const [discoveryCategories, setDiscoveryCategories] =
    useState<DiscoveryCategoryOption[]>([]);
  const [
    discoveryCategoryByCandidate,
    setDiscoveryCategoryByCandidate,
  ] = useState<Record<number, string>>({});
  const [discoveryApprovalLoading, setDiscoveryApprovalLoading] =
    useState(false);
  const [discoveryApprovalMessage, setDiscoveryApprovalMessage] =
    useState<string | null>(null);

  const selectedSite = form
    ? sites.find((site) => site.siteId === form.siteId) ?? null
    : null;
  const availableProducts = useMemo(
    () => products.filter((product) => product.siteId === form?.siteId),
    [form?.siteId, products],
  );
  const selectedProduct = form
    ? availableProducts.find((product) => product.productId === form.productId) ?? null
    : null;
  const availableCities = form ? getGlwCitiesForState(form.stateCode) : [];
  const operationTarget = form
    ? form.pageType === "city_service"
      ? "CITY"
      : form.pageType === "state_service"
        ? "STATE"
        : "GENERAL"
    : null;
  const operation = form ? form.plannedOperation ?? `CREATE_${operationTarget}` : null;
  const isUpdate = operation?.startsWith("UPDATE_") ?? false;
  const createAvailable = targetPreflight?.availability?.createAvailable ?? false;
  const updateAvailable = targetPreflight?.availability?.updateAvailable ?? false;
  const operationAvailable = isUpdate ? updateAvailable : createAvailable;

  useEffect(() => {
    if (!form) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      siteId: form.siteId,
      productId: form.productId,
      pageType: form.pageType,
      stateCode: form.stateCode,
      citySlug: form.citySlug,
      slug: form.slug,
    });
    setTargetPreflightLoading(true);
    fetch(`/api/glw/target-preflight?${query}`, {
      headers: {
        "x-gcp-roles": requestRoles.join(","),
        "x-gcp-organization-id": organizationId,
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json() as TargetPreflightResponse;
        if (!response.ok) throw new Error(body.error ?? "Target preflight failed.");
        setTargetPreflight(body);
        const targetOperation = form.pageType === "city_service" ? "CITY" : form.pageType === "state_service" ? "STATE" : "GENERAL";
        setForm((current) => current ? {
          ...current,
          plannedOperation: body.availability?.updateAvailable ? `UPDATE_${targetOperation}` : `CREATE_${targetOperation}`,
          wordpressObjectId: body.availability?.updateAvailable ? body.target?.wordpressObjectId ?? null : null,
        } : current);
        setPreview(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTargetPreflight({ error: error instanceof Error ? error.message : "Target preflight failed." });
      })
      .finally(() => {
        if (!controller.signal.aborted) setTargetPreflightLoading(false);
      });
    return () => controller.abort();
  }, [form?.siteId, form?.productId, form?.pageType, form?.stateCode, form?.citySlug, form?.slug, organizationId, requestRoles]);

  function resetFromSelection(input: {
    site: GlwGenerationSite;
    product: GlwGenerationProduct;
    pageType?: GlwPageType;
    stateCode?: string;
    citySlug?: string;
  }) {
    setForm(createDefaultGlwGenerationInput(
      input.site,
      input.product,
      input.pageType ?? form?.pageType ?? "city_service",
      input.stateCode ?? form?.stateCode ?? "TX",
      input.citySlug ?? form?.citySlug ?? "austin",
    ));
    setPreview(null);
    setExecution(null);
    setExecutionMessage(null);
  }

  function updateField<Key extends keyof GlwGenerationRequestInput>(
    key: Key,
    value: GlwGenerationRequestInput[Key],
  ) {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setPreview(null);
    setExecution(null);
    setExecutionMessage(null);
  }

  async function executeWordpressDraft() {
    if (!preview?.request || preview.request.publicationIntent !== "draft" || !executionConfigured) return;
    setExecuting(true);
    setExecutionMessage(null);
    try {
      const response = await fetch("/api/glw/page-generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gcp-roles": requestRoles.join(","),
          "x-gcp-organization-id": organizationId,
        },
        body: JSON.stringify({ form }),
      });
      const body = await response.json() as { job?: GlwPageExecutionRecord; error?: string };
      if (!response.ok || !body.job) {
        setExecutionMessage(body.error ?? "Generate WordPress Draft failed.");
        return;
      }
      setExecution(body.job);
    } catch {
      setExecutionMessage("Generate WordPress Draft request failed.");
    } finally {
      setExecuting(false);
    }
  }

  async function refreshExecution() {
    if (!execution) return;
    const response = await fetch(`/api/glw/page-generation?jobId=${encodeURIComponent(execution.jobId)}`, {
      headers: {
        "x-gcp-roles": requestRoles.join(","),
        "x-gcp-organization-id": organizationId,
      },
    });
    const body = await response.json() as { job?: GlwPageExecutionRecord; error?: string };
    if (response.ok && body.job) setExecution(body.job);
    else setExecutionMessage(body.error ?? "Unable to refresh the GLW execution.");
  }

  async function discoverCurrentSiteContent() {
    if (!initialSite) {
      return;
    }

    setSiteDiscoveryLoading(true);
    setSiteDiscovery(null);
    setSelectedDiscoveryIds(new Set());
    setDiscoveryApprovalMessage(null);

    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(initialSite.siteId)}/content-discovery`,
        {
          method: "POST",
          headers: {
            "x-gcp-roles": requestRoles.join(","),
            "x-gcp-organization-id": organizationId,
            "x-gcp-site-id": initialSite.siteId,
          },
        },
      );

      const body = await response.json() as {
        result?: SiteDiscoveryResult;
        error?: string;
      };

      if (body.result) {
        setSiteDiscovery(body.result);
        return;
      }

      setSiteDiscovery({
        ok: false,
        siteId: initialSite.siteId,
        message: body.error ?? "Site content discovery failed.",
        reason: "request_failed",
        discoveredAt: new Date().toISOString(),
      });
    } catch {
      setSiteDiscovery({
        ok: false,
        siteId: initialSite.siteId,
        message: "Genesis could not complete site content discovery.",
        reason: "network_error",
        discoveredAt: new Date().toISOString(),
      });
    } finally {
      setSiteDiscoveryLoading(false);
    }
  }
  useEffect(() => {
    let cancelled = false;

    async function loadDiscoveryCategories() {
      if (!initialSite) {
        setDiscoveryCategories([]);
        return;
      }

      try {
        const response = await fetch(
          "/api/categories",
          {
            headers: {
              "x-gcp-roles":
                requestRoles.join(","),
              "x-gcp-organization-id":
                organizationId,
              "x-gcp-site-id":
                initialSite.siteId,
            },
          },
        );

        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as {
          categories?: DiscoveryCategoryOption[];
        };

        if (cancelled) {
          return;
        }

        setDiscoveryCategories(
          (body.categories ?? []).filter(
            (category) =>
              category.organizationId ===
                organizationId &&
              category.status === "active" &&
              category.siteAssignments.includes(
                initialSite.siteId,
              ),
          ),
        );
      } catch {
        if (!cancelled) {
          setDiscoveryCategories([]);
        }
      }
    }

    void loadDiscoveryCategories();

    return () => {
      cancelled = true;
    };
  }, [
    initialSite,
    organizationId,
    requestRoles,
  ]);

  function toggleDiscoveryCandidate(
    wordpressPageId: number,
  ) {
    setSelectedDiscoveryIds((current) => {
      const next = new Set(current);

      if (next.has(wordpressPageId)) {
        next.delete(wordpressPageId);
      } else {
        next.add(wordpressPageId);
      }

      return next;
    });
  }

  function selectAllHighConfidenceCandidates() {
    if (!siteDiscovery?.ok) {
      return;
    }

    setSelectedDiscoveryIds(
      new Set(
        siteDiscovery.candidates
          .filter(
            (candidate) =>
              candidate.confidence === "high",
          )
          .map(
            (candidate) =>
              candidate.wordpressPageId,
          ),
      ),
    );
  }

  function clearDiscoverySelection() {
    setSelectedDiscoveryIds(new Set());
  }

  async function approveSelectedDiscoveryCandidates() {
    if (
      !initialSite ||
      !siteDiscovery?.ok ||
      selectedDiscoveryIds.size === 0
    ) {
      return;
    }

    const selectedCandidates =
      siteDiscovery.candidates
        .filter(
          (candidate) =>
            selectedDiscoveryIds.has(
              candidate.wordpressPageId,
            ),
        )
        .map((candidate) => ({
          ...candidate,
          categoryIds:
            discoveryCategoryByCandidate[
              candidate.wordpressPageId
            ]
              ? [
                  discoveryCategoryByCandidate[
                    candidate.wordpressPageId
                  ],
                ]
              : [],
        }));

    setDiscoveryApprovalLoading(true);
    setDiscoveryApprovalMessage(null);

    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(initialSite.siteId)}/content-discovery/approve`,
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            "x-gcp-roles":
              requestRoles.join(","),
            "x-gcp-organization-id":
              organizationId,
            "x-gcp-site-id":
              initialSite.siteId,
          },
          body: JSON.stringify({
            candidates: selectedCandidates,
          }),
        },
      );

      const body =
        await response.json() as {
          createdCount?: number;
          rejectedCount?: number;
          error?: string;
        };

      if (!response.ok) {
        setDiscoveryApprovalMessage(
          body.error ??
            "Genesis could not approve the selected candidates.",
        );

        return;
      }

      const createdCount =
        body.createdCount ?? 0;

      const rejectedCount =
        body.rejectedCount ?? 0;

      if (
        createdCount > 0 &&
        rejectedCount === 0
      ) {
        setDiscoveryApprovalMessage(
          `${createdCount} product${createdCount === 1 ? "" : "s"} approved and assigned. Reloading Page Studio...`,
        );

        window.location.reload();
        return;
      }

      setDiscoveryApprovalMessage(
        `${createdCount} approved; ${rejectedCount} require review.`,
      );
    } catch {
      setDiscoveryApprovalMessage(
        "Genesis could not complete product approval.",
      );
    } finally {
      setDiscoveryApprovalLoading(false);
    }
  }

  if (!form || !initialSite || !initialProduct) {
    return (
      <section className="space-y-5 border border-zinc-800 bg-zinc-950 p-6">
        <header>
          <p className="text-xs uppercase tracking-[0.24em] text-red-400">
            Genesis Site Studio
          </p>

          <h2 className="mt-2 text-xl font-semibold text-white">
            Build This Site's Content Catalog
          </h2>

          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            This Genesis site is connected, but it does not have any approved
            products or services assigned yet. Discover the site's existing
            content, review what Genesis finds, and approve the products and
            services that should become available in Page Studio.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Step 1
            </p>
            <p className="mt-2 font-semibold text-white">
              Discover
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Inventory existing product and service content from the connected site.
            </p>
          </div>

          <div className="border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Step 2
            </p>
            <p className="mt-2 font-semibold text-white">
              Review
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Confirm names, classifications, and which discoveries belong in Genesis.
            </p>
          </div>

          <div className="border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Step 3
            </p>
            <p className="mt-2 font-semibold text-white">
              Assign
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Approved catalog records are assigned to this site and become available for generation.
            </p>
          </div>
        </div>

        <div className="border border-red-950 bg-red-950/10 p-5">
          <p className="font-semibold text-white">
            Site Content Discovery
          </p>

          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Discovery is review-first. Nothing discovered here is published to
            WordPress, and no product becomes generation authority until it is approved.
          </p>

          <button
            type="button"
            onClick={() => void discoverCurrentSiteContent()}
            disabled={siteDiscoveryLoading}
            className="mt-4 border border-red-700 px-4 py-2 text-sm font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {siteDiscoveryLoading
              ? "Discovering Site Content..."
              : "Discover Site Content"}
          </button>

          {siteDiscovery && !siteDiscovery.ok ? (
            <div className="mt-4 border border-red-900 bg-red-950/30 p-4">
              <p className="font-semibold text-red-300">
                Discovery could not be completed
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                {siteDiscovery.message}
              </p>
            </div>
          ) : null}

          {siteDiscovery?.ok ? (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-300">
                  Pages scanned: {siteDiscovery.scannedPageCount}
                </span>
                <span className="border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-300">
                  Candidates: {siteDiscovery.candidateCount}
                </span>
                {siteDiscovery.truncated ? (
                  <span className="border border-amber-900 bg-amber-950/20 px-3 py-2 text-amber-300">
                    Inventory limit reached
                  </span>
                ) : null}
              </div>

              <div>
                <p className="font-semibold text-white">
                  Review Discovered Products &amp; Services
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  These are candidates only. Genesis has not created or assigned any products.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllHighConfidenceCandidates}
                    className="border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300"
                  >
                    Select High Confidence
                  </button>

                  <button
                    type="button"
                    onClick={clearDiscoverySelection}
                    disabled={selectedDiscoveryIds.size === 0}
                    className="border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-400 disabled:opacity-40"
                  >
                    Clear Selection
                  </button>

                  <span className="px-2 text-xs text-zinc-500">
                    Selected: {selectedDiscoveryIds.size}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      void approveSelectedDiscoveryCandidates()
                    }
                    disabled={
                      discoveryApprovalLoading ||
                      selectedDiscoveryIds.size === 0
                    }
                    className="border border-red-700 bg-red-950/20 px-4 py-2 text-xs font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {discoveryApprovalLoading
                      ? "Approving..."
                      : "Approve & Assign Selected"}
                  </button>
                </div>

                {discoveryApprovalMessage ? (
                  <div className="mt-3 border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                    {discoveryApprovalMessage}
                  </div>
                ) : null}
              </div>

              {siteDiscovery.candidates.length === 0 ? (
                <div className="border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                  No product or service candidates met the current discovery threshold.
                </div>
              ) : (
                <div className="space-y-2">
                  {siteDiscovery.candidates.map((candidate) => (
                    <article
                      key={candidate.wordpressPageId}
                      className="border border-zinc-800 bg-zinc-950 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedDiscoveryIds.has(
                              candidate.wordpressPageId,
                            )}
                            onChange={() =>
                              toggleDiscoveryCandidate(
                                candidate.wordpressPageId,
                              )
                            }
                            aria-label={`Select ${candidate.title}`}
                            className="mt-1 h-4 w-4"
                          />

                          <div className="min-w-0">
                            <p className="font-semibold text-white">
                              {candidate.title}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              /{candidate.slug}
                            </p>

                            <label className="mt-3 block text-xs text-zinc-400">
                              Category

                              <select
                                value={
                                  discoveryCategoryByCandidate[
                                    candidate.wordpressPageId
                                  ] ?? ""
                                }
                                onChange={(event) =>
                                  setDiscoveryCategoryByCandidate(
                                    (current) => ({
                                      ...current,
                                      [candidate.wordpressPageId]:
                                        event.target.value,
                                    }),
                                  )
                                }
                                className="mt-1 block w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                              >
                                <option value="">
                                  Select category
                                </option>

                                {discoveryCategories.map(
                                  (category) => (
                                    <option
                                      key={category.categoryId}
                                      value={category.categoryId}
                                    >
                                      {category.name}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                          </div>
                        </div>

                        <span className="border border-zinc-700 px-2 py-1 text-xs uppercase text-zinc-300">
                          {candidate.confidence} confidence
                        </span>
                      </div>

                      <a
                        href={candidate.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 block break-all text-xs text-red-300 underline"
                      >
                        {candidate.sourceUrl}
                      </a>

                      {candidate.evidence.length > 0 ? (
                        <p className="mt-3 text-xs text-zinc-500">
                          {candidate.evidence.join(" · ")}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}

              <button
                type="button"
                disabled
                className="border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-400 opacity-60"
                title="Approval and Genesis product creation are the next controlled slice."
              >
                Approve Selected Products &amp; Services
              </button>

              <p className="text-xs text-zinc-500">
                Approval remains disabled until the review-and-assignment authority is implemented.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5 border border-zinc-800 bg-zinc-950 p-5">
      <header>
        <p className="text-xs uppercase text-red-400">Genesis Site Studio</p>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-500">
          Genesis Site Studio
        </p>        <h2 className="mt-1 text-lg font-semibold text-white">Create a WordPress Page</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Choose the page target, review its WordPress destination, then generate safely as a draft.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm text-zinc-300">
          Operation
          <select
            aria-label="Generation operation"
            value={operation}
            onChange={(event) => {
              const plannedOperation = event.target.value as GlwLocalPlannedOperation;
              setForm((current) => current ? {
                ...current,
                plannedOperation,
                wordpressObjectId: plannedOperation.startsWith("UPDATE_")
                  ? current.wordpressObjectId
                  : null,
              } : current);
              setPreview(null);
              setExecution(null);
              setExecutionMessage(null);
            }}
            className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3"
          >
            <option value={`CREATE_${operationTarget}`} disabled={!createAvailable}>Create new draft</option>
            <option value={`UPDATE_${operationTarget}`} disabled={!updateAvailable}>Update exact draft</option>
          </select>
        </label>

        {isUpdate ? (
          <label className="text-sm text-zinc-300">
            WordPress object ID
            <input
              aria-label="WordPress object ID"
              inputMode="numeric"
              value={form.wordpressObjectId ?? ""}
              onChange={(event) => updateField("wordpressObjectId", event.target.value)}
              className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3"
            />
          </label>
        ) : null}

        <label className="text-sm text-zinc-300">
          Site
          <select
            aria-label="Generation site"
            value={form.siteId}
            onChange={(event) => {
              const site = sites.find((entry) => entry.siteId === event.target.value);
              const product = site ? firstProductForSite(products, site.siteId) : null;
              if (site && product) resetFromSelection({ site, product });
            }}
            className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3"
          >
            {sites.map((site) => <option key={site.siteId} value={site.siteId}>{site.name} ({site.environment})</option>)}
          </select>
        </label>

        <label className="text-sm text-zinc-300">
          Product / topic
          <select
            aria-label="Generation product"
            value={form.productId}
            onChange={(event) => {
              const product = availableProducts.find((entry) => entry.productId === event.target.value);
              if (selectedSite && product) resetFromSelection({ site: selectedSite, product });
            }}
            className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3"
          >
            {availableProducts.map((product) => <option key={product.productId} value={product.productId}>{product.name}</option>)}
          </select>
        </label>

        <label className="text-sm text-zinc-300">
          Page type
          <select
            aria-label="Page type"
            value={form.pageType}
            onChange={(event) => {
              const pageType = event.target.value as GlwPageType;
              if (selectedSite && selectedProduct) {
                resetFromSelection({
                  site: selectedSite,
                  product: selectedProduct,
                  pageType,
                  stateCode: form.stateCode || "TX",
                  citySlug: form.citySlug || "austin",
                });
              }
            }}
            className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3"
          >
            <option value="general_service">General Product / Service Page</option>
            <option value="state_service">State Market Page</option>
            <option value="city_service">City / Local Market Page</option>
          </select>
        </label>

        {form.pageType !== "general_service" ? (
          <label className="text-sm text-zinc-300">
            State
            <select
              aria-label="Generation state"
              value={form.stateCode}
              onChange={(event) => {
                const stateCode = event.target.value;
                const citySlug = getGlwCitiesForState(stateCode)[0]?.slug ?? "";
                if (selectedSite && selectedProduct) resetFromSelection({ site: selectedSite, product: selectedProduct, stateCode, citySlug });
              }}
              className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3"
            >
              {GLW_STATES.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
            </select>
          </label>
        ) : null}

        {form.pageType === "city_service" ? (
          <label className="text-sm text-zinc-300">
            City
            <select
              aria-label="Generation city"
              value={form.citySlug}
              onChange={(event) => {
                if (selectedSite && selectedProduct) resetFromSelection({ site: selectedSite, product: selectedProduct, citySlug: event.target.value });
              }}
              className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3"
            >
              {availableCities.map((city) => <option key={city.slug} value={city.slug}>{city.name}</option>)}
            </select>
          </label>
        ) : null}

        <label className="text-sm text-zinc-300">
          Publication intent
          <select
            aria-label="Publication intent"
            value={form.publicationIntent}
            onChange={(event) => updateField("publicationIntent", event.target.value as GlwPublicationIntent)}
            className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3"
          >
            <option value="draft">Create as WordPress Draft</option>
            <option value="publish">Publish intent</option>
          </select>
        </label>
      </div>

      <article className="border border-zinc-700 bg-zinc-900/60 p-4" aria-live="polite">
        <h3 className="text-sm font-semibold text-white">WordPress Target</h3>
        {targetPreflightLoading ? (
          <p className="mt-2 text-sm text-zinc-400">Checking canonical target...</p>
        ) : targetPreflight?.target && targetPreflight.availability ? (
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <div><dt className="text-zinc-500">Application path</dt><dd>/{targetPreflight.target.applicationPath}</dd></div>
            <div><dt className="text-zinc-500">Canonical WordPress path</dt><dd>/{targetPreflight.target.canonicalPath}</dd></div>
            <div><dt className="text-zinc-500">Target state</dt><dd>{targetPreflight.target.state}</dd></div>
            <div><dt className="text-zinc-500">WordPress leaf</dt><dd>{targetPreflight.target.canonicalSlug}</dd></div>
            <div><dt className="text-zinc-500">Parent</dt><dd>{targetPreflight.target.canonicalParentId ?? "Unverified"}</dd></div>
            <div><dt className="text-zinc-500">WordPress ID</dt><dd>{targetPreflight.target.wordpressObjectId ?? "Unverified"}</dd></div>
            <div><dt className="text-zinc-500">WordPress status</dt><dd>{targetPreflight.target.wordpressStatus ?? "Unverified"}</dd></div>
            <div><dt className="text-zinc-500">Title</dt><dd>{targetPreflight.target.wordpressTitle ?? "Unverified"}</dd></div>
            <div className="md:col-span-2"><dt className="text-zinc-500">Mutation availability</dt><dd>{targetPreflight.availability.message}</dd></div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-amber-300">
            Target state is unknown. Target existence must be verified authoritatively before creation.
          </p>
        )}
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-zinc-300 md:col-span-2">
          Canonical slug / path
          <input aria-label="Canonical slug" value={form.slug} onChange={(event) => updateField("slug", event.target.value)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3" />
        </label>
        <label className="text-sm text-zinc-300">
          Page title
          <input aria-label="Page title" value={form.title} onChange={(event) => updateField("title", event.target.value)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3" />
        </label>
        <label className="text-sm text-zinc-300">
          SEO title
          <input aria-label="SEO title" value={form.seoTitle} onChange={(event) => updateField("seoTitle", event.target.value)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3" />
        </label>
        <label className="text-sm text-zinc-300 md:col-span-2">
          Meta description
          <textarea aria-label="Meta description" value={form.metaDescription} onChange={(event) => updateField("metaDescription", event.target.value)} className="mt-1 min-h-24 w-full border border-zinc-700 bg-zinc-900 p-3" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canPrepareRequest}
          onClick={() => setPreview(buildLocalGlwGenerationPreview({ form, sites, products }))}
          className="border border-red-500 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Prepare Page
        </button>
        <span className="text-xs text-zinc-500">
          {selectedSite?.profileCount ?? 0} current integration profiles available; none are executed here.
        </span>
      </div>

      {preview ? (
        <article className="border border-zinc-700 bg-zinc-900/60 p-4" aria-live="polite">
          <h3 className="text-sm font-semibold text-white">Local request preview</h3>
          {!preview.validation.valid ? (
            <ul className="mt-3 space-y-1 text-sm text-amber-300">
              {preview.validation.issues.map((issue) => <li key={`${issue.field}-${issue.message}`}>{issue.field}: {issue.message}</li>)}
            </ul>
          ) : preview.request ? (
            <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <div><dt className="text-zinc-500">Website</dt><dd>{preview.request.siteName}</dd></div>
              <div><dt className="text-zinc-500">Product/topic</dt><dd>{preview.request.productTopic}</dd></div>
              <div><dt className="text-zinc-500">Geography</dt><dd>{[preview.request.cityName, preview.request.stateName].filter(Boolean).join(", ") || "General"}</dd></div>
              <div><dt className="text-zinc-500">Planned operation</dt><dd>{operationAvailable ? preview.request.plannedOperation : "BLOCKED"}</dd></div>
              <div className="md:col-span-2"><dt className="text-zinc-500">Canonical path</dt><dd>/{preview.request.canonicalPath}</dd></div>
              <div className="md:col-span-2"><dt className="text-zinc-500">Canonical WordPress identity</dt><dd>/{targetPreflight?.target?.canonicalPath ?? "Unverified"}</dd></div>
              <div><dt className="text-zinc-500">Title</dt><dd>{preview.request.title}</dd></div>
              <div><dt className="text-zinc-500">SEO title</dt><dd>{preview.request.seoTitle}</dd></div>
              <div className="md:col-span-2"><dt className="text-zinc-500">Meta description</dt><dd>{preview.request.metaDescription}</dd></div>
              <div><dt className="text-zinc-500">Publishing</dt><dd>{preview.request.publicationIntent}</dd></div>
              <div><dt className="text-zinc-500">WordPress target</dt><dd>{targetPreflight?.target?.wordpressObjectId ? `Existing page ${targetPreflight.target.wordpressObjectId}` : targetPreflight?.target?.state === "ABSENT" ? "New object" : "Unverified"}</dd></div>
              <div><dt className="text-zinc-500">External execution</dt><dd>Disabled</dd></div>
            </dl>
          ) : null}
        </article>
      ) : null}

      <article className="border border-zinc-700 bg-zinc-900/60 p-4">
        <h3 className="text-sm font-semibold text-white">Generate WordPress Draft</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Transport: {executionWorkflowName}. Public publish remains blocked.
        </p>
        <p className={`mt-2 text-xs ${executionConfigured ? "text-emerald-300" : "text-amber-300"}`}>
          {executionConfigured
            ? "Server-side n8n MCP configuration is present."
            : "Draft generation is not yet available for this site."}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={
              executing ||
              !executionConfigured ||
              !preview?.request ||
              targetPreflightLoading ||
              !operationAvailable ||
              preview.request.publicationIntent !== "draft"
            }
            onClick={executeWordpressDraft}
            className="border border-amber-500 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {executing
              ? (isUpdate ? "Updating exact WordPress draft..." : "Creating WordPress draft...")
              : (isUpdate ? "Update WordPress Draft" : "Generate WordPress Draft")}
          </button>
          {execution ? (
            <button type="button" onClick={refreshExecution} className="border border-zinc-600 px-4 py-2 text-sm text-zinc-200">
              Refresh result
            </button>
          ) : null}
        </div>
        {preview?.request?.publicationIntent === "publish" ? (
          <p className="mt-2 text-xs text-amber-300">Select Draft intent to enable external execution.</p>
        ) : null}
        {executionMessage ? <p className="mt-3 text-sm text-red-300">{executionMessage}</p> : null}
        {execution ? (
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div><dt className="text-zinc-500">Job ID</dt><dd>{execution.jobId}</dd></div>
            <div><dt className="text-zinc-500">Status</dt><dd>{execution.status}</dd></div>
            <div><dt className="text-zinc-500">Transport</dt><dd>{execution.executionTransport}</dd></div>
            <div><dt className="text-zinc-500">Disposition</dt><dd>{execution.disposition ?? "Pending"}</dd></div>
            <div><dt className="text-zinc-500">External execution</dt><dd>{execution.externalExecutionId ?? "Pending"}</dd></div>
            <div><dt className="text-zinc-500">WordPress ID</dt><dd>{execution.wordpressObjectId ?? "Pending"}</dd></div>
            <div><dt className="text-zinc-500">WordPress status</dt><dd>{execution.wordpressStatus ?? "Pending"}</dd></div>
            <div><dt className="text-zinc-500">WordPress URL</dt><dd>{execution.wordpressUrl ?? "Pending"}</dd></div>
            <div><dt className="text-zinc-500">QA status</dt><dd>{execution.qaStatus ?? "Pending"}</dd></div>
            <div><dt className="text-zinc-500">Featured image</dt><dd>{execution.featuredImagePresent === null ? "Pending" : execution.featuredImagePresent ? "Present" : "Missing"}</dd></div>
            {execution.errorMessage ? <div className="md:col-span-2"><dt className="text-zinc-500">Failure</dt><dd className="text-red-300">{execution.errorCode}: {execution.errorMessage}</dd></div> : null}
          </dl>
        ) : null}
      </article>
    </section>
  );
}