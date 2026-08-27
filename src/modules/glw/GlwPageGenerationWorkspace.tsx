"use client";

import { useMemo, useState } from "react";
import {
  GLW_STATES,
  buildLocalGlwGenerationPreview,
  createDefaultGlwGenerationInput,
  getGlwCitiesForState,
  type GlwGenerationProduct,
  type GlwGenerationRequestInput,
  type GlwGenerationSite,
  type GlwLocalGenerationPreview,
  type GlwPageType,
  type GlwPublicationIntent,
} from "./page-generation";
import type { GlwPageExecutionRecord } from "./page-execution";

type Props = {
  sites: readonly GlwGenerationSite[];
  products: readonly GlwGenerationProduct[];
  canPrepareRequest: boolean;
  executionConfigured: boolean;
  executionWorkflowName: string;
  requestRoles: readonly string[];
  organizationId: string;
};

function firstProductForSite(
  products: readonly GlwGenerationProduct[],
  siteId: string,
): GlwGenerationProduct | null {
  return products.find((product) => product.siteId === siteId) ?? null;
}

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
        setExecutionMessage(body.error ?? "WordPress draft execution failed.");
        return;
      }
      setExecution(body.job);
    } catch {
      setExecutionMessage("WordPress draft execution request failed.");
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

  if (!form || !initialSite || !initialProduct) {
    return (
      <section className="border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-semibold text-white">Page Generation</h2>
        <p className="mt-2 text-sm text-amber-300">
          A current site with an assigned product is required before a request can be prepared.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 border border-zinc-800 bg-zinc-950 p-5">
      <header>
        <p className="text-xs uppercase text-red-400">Recovered page-generation workflow</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Prepare a local generation request</h2>
        <p className="mt-2 text-sm text-zinc-400">
          This slice validates local request data only. It does not call n8n, WordPress, callbacks, or deployment.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            <option value="general_service">General service</option>
            <option value="state_service">State service</option>
            <option value="city_service">City service</option>
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
            <option value="draft">Draft intent</option>
            <option value="publish">Publish intent</option>
          </select>
        </label>
      </div>

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
          Build local request
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
              <div><dt className="text-zinc-500">Site</dt><dd>{preview.request.siteName}</dd></div>
              <div><dt className="text-zinc-500">Product/topic</dt><dd>{preview.request.productTopic}</dd></div>
              <div><dt className="text-zinc-500">Geography</dt><dd>{[preview.request.cityName, preview.request.stateName].filter(Boolean).join(", ") || "General"}</dd></div>
              <div><dt className="text-zinc-500">Planned operation</dt><dd>{preview.request.plannedOperation}</dd></div>
              <div className="md:col-span-2"><dt className="text-zinc-500">Canonical path</dt><dd>/{preview.request.canonicalPath}</dd></div>
              <div><dt className="text-zinc-500">Title</dt><dd>{preview.request.title}</dd></div>
              <div><dt className="text-zinc-500">SEO title</dt><dd>{preview.request.seoTitle}</dd></div>
              <div className="md:col-span-2"><dt className="text-zinc-500">Meta description</dt><dd>{preview.request.metaDescription}</dd></div>
              <div><dt className="text-zinc-500">Publication intent</dt><dd>{preview.request.publicationIntent}</dd></div>
              <div><dt className="text-zinc-500">External execution</dt><dd>Disabled</dd></div>
            </dl>
          ) : null}
        </article>
      ) : null}

      <article className="border border-zinc-700 bg-zinc-900/60 p-4">
        <h3 className="text-sm font-semibold text-white">WordPress draft execution</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Transport: {executionWorkflowName}. Public publish remains blocked.
        </p>
        <p className={`mt-2 text-xs ${executionConfigured ? "text-emerald-300" : "text-amber-300"}`}>
          {executionConfigured
            ? "Server-side n8n MCP configuration is present."
            : "Server-side n8n MCP configuration is not present; execution is disabled."}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={
              executing ||
              !executionConfigured ||
              !preview?.request ||
              preview.request.publicationIntent !== "draft"
            }
            onClick={executeWordpressDraft}
            className="border border-amber-500 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {executing ? "Creating WordPress draft..." : "Create one WordPress draft"}
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
            <div><dt className="text-zinc-500">External execution</dt><dd>{execution.externalExecutionId ?? "Pending"}</dd></div>
            <div><dt className="text-zinc-500">WordPress ID</dt><dd>{execution.wordpressObjectId ?? "Pending"}</dd></div>
            <div><dt className="text-zinc-500">WordPress status</dt><dd>{execution.wordpressStatus ?? "Pending"}</dd></div>
            <div><dt className="text-zinc-500">WordPress URL</dt><dd>{execution.wordpressUrl ?? "Pending"}</dd></div>
            {execution.errorMessage ? <div className="md:col-span-2"><dt className="text-zinc-500">Failure</dt><dd className="text-red-300">{execution.errorCode}: {execution.errorMessage}</dd></div> : null}
          </dl>
        ) : null}
      </article>
    </section>
  );
}