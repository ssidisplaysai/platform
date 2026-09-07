"use client";

import React from "react";
import { useMemo, useState } from "react";
import { GLW_CITIES, GLW_STATES } from "./page-generation";
import type {
  GlwCampaignLaunchpadInput,
  GlwCampaignLaunchpadPreflight,
  GlwCampaignReach,
} from "./campaign-launchpad";

const REACH_OPTIONS: readonly { value: GlwCampaignReach; label: string; detail: string; available: boolean }[] = [
  { value: "NATIONWIDE", label: "Nationwide", detail: "Discover the maximum useful footprint supported by current Genesis targets.", available: true },
  { value: "STATE", label: "State", detail: "Plan supported targets within one state.", available: true },
  { value: "MULTI_STATE_REGION", label: "Multi-State / Region", detail: "Combine supported states into one regional plan.", available: true },
  { value: "METRO_LOCAL", label: "Metro / Local", detail: "Focus on one currently supported metro.", available: true },
  { value: "CUSTOM", label: "Custom", detail: "Not yet supported by current campaign target authority.", available: false },
];

type Props = {
  organizationId: string;
  requestRoles: readonly string[];
  existingProducts?: readonly { name: string; url: string }[];
};
type PreflightResponse = { preflight?: GlwCampaignLaunchpadPreflight; error?: string };

function displayValue(value: string | number | null): string {
  return value === null ? "UNKNOWN" : String(value).replaceAll("_", " ");
}

export function CampaignPreflight({ preflight }: { preflight: GlwCampaignLaunchpadPreflight }) {
  const ready = preflight.readiness === "READY" || preflight.readiness === "READY_WITH_REVIEW";
  const campaignSizes = [25, 50, 100, 250].filter((size) => size <= preflight.maximumSafeReach);
  return (
    <section aria-label="Campaign Preflight" className="space-y-5 border-t border-zinc-800 pt-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Campaign Preflight</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Genesis recommendation</h2>
          <p className="mt-1 text-sm text-zinc-400">Read-only analysis. No campaign or content was created.</p>
        </div>
        <span className={`w-fit border px-3 py-2 text-sm font-bold ${ready ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-amber-500/50 bg-amber-500/10 text-amber-300"}`}>
          {displayValue(preflight.readiness)}
        </span>
      </div>

      <div className="grid gap-px overflow-hidden border border-zinc-800 bg-zinc-800 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Potential reach", preflight.potentialReach],
          ["Maximum safe reach", preflight.maximumSafeReach],
          ["Existing coverage", preflight.existingCoverage],
          ["Authority blocked", preflight.authorityBlockedTargets],
        ].map(([label, value]) => (
          <div key={label} className="bg-zinc-950 p-4">
            <p className="text-xs uppercase text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-sm font-semibold text-white">Product and authority</h3>
          <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 text-sm">
            <dt className="text-zinc-400">Detected site</dt><dd className="text-right text-white">{preflight.site.name}</dd>
            <dt className="text-zinc-400">Detected product</dt><dd className="text-right text-white">{preflight.product?.name ?? "UNKNOWN"}</dd>
            <dt className="text-zinc-400">Product authority</dt><dd className="text-right text-white">{displayValue(preflight.productAuthorityState)}</dd>
            <dt className="text-zinc-400">Source authority</dt><dd className="text-right text-white">{displayValue(preflight.sourceAuthorityState)}</dd>
            <dt className="text-zinc-400">Publication policy</dt><dd className="text-right text-white">{preflight.publicationPolicy}</dd>
          </dl>
          <p className="mt-4 break-all text-xs text-zinc-500">{preflight.canonicalProductUrl}</p>
        </section>

        <section className="border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-sm font-semibold text-white">Coverage and conflicts</h3>
          <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 text-sm">
            <dt className="text-zinc-400">Desired reach</dt><dd className="text-right text-white">{displayValue(preflight.desiredReach)}</dd>
            <dt className="text-zinc-400">Eligible targets</dt><dd className="text-right text-white">{preflight.availableEligibleTargets}</dd>
            <dt className="text-zinc-400">Duplicates excluded</dt><dd className="text-right text-white">{preflight.duplicateTargetsExcluded}</dd>
            <dt className="text-zinc-400">Campaign conflicts</dt><dd className="text-right text-white">{displayValue(preflight.existingCampaignConflicts)}</dd>
            <dt className="text-zinc-400">Cannibalization conflicts</dt><dd className="text-right text-white">{displayValue(preflight.cannibalizationConflicts)}</dd>
          </dl>
        </section>
      </div>

      {preflight.blockers.length > 0 ? (
        <section className="border border-amber-600/40 bg-amber-950/20 p-5">
          <h3 className="text-sm font-semibold text-amber-200">Review required</h3>
          <ul className="mt-3 space-y-2 text-sm text-amber-100">
            {preflight.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        </section>
      ) : null}

      <section className="border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-semibold text-white">Campaign size</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={preflight.recommendedInitialBatch === 0} className="border border-red-500 bg-red-600 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500">Recommended Launch ({preflight.recommendedInitialBatch})</button>
          {campaignSizes.map((size) => <button key={size} type="button" className="border border-zinc-700 px-3 py-2 text-sm text-zinc-200">Top {size}</button>)}
          <button type="button" disabled={preflight.maximumSafeReach === 0} className="border border-zinc-700 px-3 py-2 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-600">Full Safe Reach ({preflight.maximumSafeReach})</button>
          <button type="button" disabled className="border border-zinc-800 px-3 py-2 text-sm text-zinc-600">Custom</button>
        </div>
      </section>

      <details className="border border-zinc-800 bg-zinc-950 p-4 text-sm">
        <summary className="cursor-pointer text-zinc-300">Technical details</summary>
        <div className="mt-3 grid gap-2 text-zinc-500 sm:grid-cols-2">
          <p>Target authority: {preflight.technicalDetails.targetAuthority}</p>
          <p>Source mode: {preflight.technicalDetails.sourceMode}</p>
          <p>Eligible target structures: {preflight.targets.length}</p>
          <p>Campaign ownership analysis: {displayValue(preflight.existingCampaignConflicts)}</p>
        </div>
      </details>

      <div className="flex flex-col items-start gap-2 border-t border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-400">Campaign execution will be enabled after Launchpad preflight certification.</p>
        <button type="button" disabled className="min-h-11 border border-zinc-700 bg-zinc-800 px-5 text-sm font-semibold text-zinc-500 disabled:cursor-not-allowed">Launch Campaign</button>
      </div>
    </section>
  );
}

export function CampaignLaunchpad({ organizationId, requestRoles, existingProducts = [] }: Props) {
  const [reach, setReach] = useState<GlwCampaignReach>("NATIONWIDE");
  const [productUrl, setProductUrl] = useState("");
  const [selectedProductUrl, setSelectedProductUrl] = useState("");
  const [stateCodes, setStateCodes] = useState<string[]>([]);
  const [metro, setMetro] = useState("");
  const [preflight, setPreflight] = useState<GlwCampaignLaunchpadPreflight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlValid = useMemo(() => {
    try { const url = new URL(productUrl); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
    catch { return false; }
  }, [productUrl]);
  const reachValid = reach === "NATIONWIDE"
    || (reach === "STATE" && stateCodes.length === 1)
    || (reach === "MULTI_STATE_REGION" && stateCodes.length > 1)
    || (reach === "METRO_LOCAL" && Boolean(metro));

  async function analyze() {
    if (!urlValid || !reachValid) return;
    const request: GlwCampaignLaunchpadInput = { reach, productUrl, stateCodes, metro };
    setLoading(true); setError(null); setPreflight(null);
    try {
      const response = await fetch("/api/glw/campaign-launchpad/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gcp-roles": requestRoles.join(","), "x-gcp-organization-id": organizationId },
        body: JSON.stringify(request),
      });
      const body = await response.json() as PreflightResponse;
      if (!response.ok || !body.preflight) throw new Error(body.error ?? "Campaign analysis failed.");
      setPreflight(body.preflight);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Campaign analysis failed.");
    } finally { setLoading(false); }
  }

  return (
    <section className="border border-zinc-800 bg-zinc-950 p-5 md:p-7">
      <div className="space-y-8">
        <fieldset>
          <legend className="text-xs uppercase tracking-[0.25em] text-red-400">1. Desired Reach</legend>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {REACH_OPTIONS.map((option) => (
              <label key={option.value} className={`relative border p-4 ${reach === option.value ? "border-red-500 bg-red-950/20" : "border-zinc-800 bg-zinc-900/50"} ${option.available ? "cursor-pointer" : "cursor-not-allowed opacity-55"}`}>
                <input className="sr-only" type="radio" name="reach" value={option.value} disabled={!option.available} checked={reach === option.value} onChange={() => { setReach(option.value); setStateCodes([]); setMetro(""); setPreflight(null); }} />
                <span className="block text-sm font-semibold text-white">{option.label}</span>
                {option.value === "NATIONWIDE" ? <span className="mt-2 inline-block border border-red-500/40 px-2 py-1 text-xs text-red-300">Recommended</span> : null}
                <span className="mt-2 block text-xs leading-5 text-zinc-400">{option.detail}</span>
              </label>
            ))}
          </div>
          {(reach === "STATE" || reach === "MULTI_STATE_REGION") ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {GLW_STATES.map((state) => <label key={state.code} className="flex min-h-11 items-center gap-3 border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"><input type={reach === "STATE" ? "radio" : "checkbox"} name="states" checked={stateCodes.includes(state.code)} onChange={() => setStateCodes((current) => reach === "STATE" ? [state.code] : current.includes(state.code) ? current.filter((code) => code !== state.code) : [...current, state.code])} />{state.name}</label>)}
            </div>
          ) : null}
          {reach === "METRO_LOCAL" ? (
            <label className="mt-4 block max-w-md text-sm text-zinc-300">Supported metro<select aria-label="Supported metro" value={metro} onChange={(event) => setMetro(event.target.value)} className="mt-2 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white"><option value="">Select a metro</option>{Array.from(new Set(GLW_CITIES.map((city) => city.metro))).map((name) => <option key={name}>{name}</option>)}</select></label>
          ) : null}
        </fieldset>

        <section>
          <label htmlFor="campaign-product-url" className="text-xs uppercase tracking-[0.25em] text-red-400">2. Product</label>
          <p className="mt-2 text-sm text-zinc-400">Use the canonical product page as an onboarding seed. Genesis will verify it against registered authority.</p>
          {existingProducts.length > 0 ? (
            <label className="mt-4 block max-w-xl text-sm text-zinc-300">Select existing Genesis product
              <select aria-label="Select existing Genesis product" value={selectedProductUrl} onChange={(event) => { const value = event.target.value; setSelectedProductUrl(value); if (value) setProductUrl(value); setPreflight(null); setError(null); }} className="mt-2 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white">
                <option value="">Choose a registered product</option>
                {existingProducts.map((product) => <option key={product.url} value={product.url}>{product.name}</option>)}
              </select>
            </label>
          ) : null}
          <input id="campaign-product-url" type="url" inputMode="url" value={productUrl} onChange={(event) => { setProductUrl(event.target.value); setSelectedProductUrl(""); setPreflight(null); setError(null); }} placeholder="https://www.example.com/product/" aria-invalid={productUrl.length > 0 && !urlValid} className="mt-3 h-12 w-full border border-zinc-700 bg-zinc-900 px-4 text-white outline-none focus:border-red-500" />
          {productUrl && !urlValid ? <p className="mt-2 text-sm text-amber-300">Enter a valid HTTP or HTTPS product URL.</p> : null}
        </section>

        <section>
          <p className="text-xs uppercase tracking-[0.25em] text-red-400">3. Analyze</p>
          <button type="button" onClick={analyze} disabled={!urlValid || !reachValid || loading} className="mt-3 min-h-12 w-full bg-red-600 px-5 text-sm font-bold text-white transition enabled:hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 sm:w-auto">
            {loading ? "Analyzing campaign..." : "Analyze Campaign"}
          </button>
          {loading ? <p role="status" className="mt-3 text-sm text-zinc-400">Checking registered authority, existing coverage, and supported targets.</p> : null}
          {error ? <div role="alert" className="mt-4 border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}
        </section>

        {preflight ? <CampaignPreflight preflight={preflight} /> : (
          <section className="border-t border-zinc-800 pt-6 text-sm text-zinc-500">Campaign preflight will appear here after analysis.</section>
        )}
      </div>
    </section>
  );
}