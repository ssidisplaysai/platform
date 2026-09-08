"use client";

import React from "react";
import { useMemo, useState } from "react";
import { createConfiguredAtomicRuntimeCampaignLaunchAdapter, createDisabledCampaignLaunchAdapter, createSyntheticCampaignLaunchAdapter, type GlwSyntheticLaunchScenario } from "./campaign-launch-adapter";
import type { GlwCampaignLaunchAdapter, GlwCampaignLaunchRequest, GlwCampaignLaunchResult, GlwLaunchUiState } from "./campaign-launch-contract";
import { presentGlwLaunchResult } from "./campaign-launch-contract";
import { CampaignLaunchConfirmation, CampaignLaunchOutcome, CampaignLaunchProgress } from "./CampaignLaunchExperience";
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
  launchExecutionAvailable?: boolean;
  atomicLaunchAvailable?: boolean;
  launchCapabilityReason?: string;
  launchAdapter?: GlwCampaignLaunchAdapter;
};
type PreflightResponse = { preflight?: GlwCampaignLaunchpadPreflight; error?: string };

function displayValue(value: string | number | null): string {
  return value === null ? "UNKNOWN" : String(value).replaceAll("_", " ");
}

export function CampaignPreflight({ preflight, selectedBatchSize = 0, onSelectBatchSize, onLaunch, launchAvailable = false, launchCapabilityAvailable = false, launchCapabilityReason, launchBusy = false }: {
  preflight: GlwCampaignLaunchpadPreflight;
  selectedBatchSize?: number;
  onSelectBatchSize?: (size: number) => void;
  onLaunch?: () => void;
  launchAvailable?: boolean;
  launchCapabilityAvailable?: boolean;
  launchCapabilityReason?: string;
  launchBusy?: boolean;
}) {
  const ready = preflight.readiness === "READY" || preflight.readiness === "READY_WITH_REVIEW";
  const campaignSizes = [25, 50, 100, 250].filter((size) => size <= preflight.maximumSafeReach);
  const exclusionGroups = [
    ["EXISTING_COVERAGE", "Already Covered"],
    ["EXECUTION_OWNED", "Owned by Execution"],
    ["CAMPAIGN_OWNED", "Owned by Campaign"],
    ["CANNIBALIZATION_CONFLICT", "Cannibalization Conflict"],
    ["AUTHORITY_BLOCKED", "Authority Required"],
    ["UNSUPPORTED", "Unsupported"],
    ["UNRECONCILED", "Unreconciled"],
  ] as const;
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
          ["Existing coverage", preflight.existingCoverage],
          ["Execution ownership", preflight.counts.executionOwnedCount],
          ["Campaign ownership", preflight.existingCampaignConflicts],
          ["Cannibalization conflicts", preflight.cannibalizationConflicts],
          ["Authority blocked", preflight.authorityBlockedTargets],
          ["Unreconciled", preflight.counts.unreconciledCount],
          ["Maximum safe reach", preflight.maximumSafeReach],
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

      {preflight.readinessBlockers.length > 0 ? (
        <section className="border border-amber-600/40 bg-amber-950/20 p-5">
          <h3 className="text-sm font-semibold text-amber-200">Campaign readiness blockers</h3>
          <ul className="mt-3 space-y-2 text-sm text-amber-100">
            {preflight.readinessBlockers.map((blocker) => (
              <li key={`${blocker.scope}-${blocker.code}`} className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <span>{blocker.message}</span>
                <span className="text-xs text-amber-300/70">{displayValue(blocker.scope)} / {displayValue(blocker.code)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="border border-zinc-800 bg-zinc-900/50 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-white">Excluded Targets ({preflight.excludedTargets.length})</summary>
        <div className="mt-4 space-y-4">
          {exclusionGroups.map(([group, label]) => {
            const exclusions = preflight.excludedTargets.filter((target) => target.group === group);
            return (
              <section key={group}>
                <h4 className="text-xs uppercase text-zinc-500">{label} ({exclusions.length})</h4>
                {exclusions.length > 0 ? (
                  <ul className="mt-2 divide-y divide-zinc-800 border border-zinc-800">
                    {exclusions.slice(0, 25).map((target) => (
                      <li key={`${group}-${target.canonicalPath}`} className="p-3 text-sm">
                        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                          <span className="font-medium text-zinc-200">{target.target}</span>
                          {target.campaignId ? <span className="text-xs text-zinc-500">Campaign: {target.campaignId}</span> : null}
                          {target.jobId ? <span className="text-xs text-zinc-500">Job: {target.jobId}</span> : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-zinc-400">{target.reason}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      </details>

      <section className="border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-semibold text-white">Campaign size</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onSelectBatchSize?.(preflight.recommendedInitialBatch)} disabled={preflight.recommendedInitialBatch === 0} className={`border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500 ${selectedBatchSize === preflight.recommendedInitialBatch && selectedBatchSize > 0 ? "border-red-500 bg-red-600 text-white" : "border-zinc-700 text-zinc-200"}`}>Recommended Launch ({preflight.recommendedInitialBatch})</button>
          {campaignSizes.map((size) => <button key={size} type="button" onClick={() => onSelectBatchSize?.(size)} className={`border px-3 py-2 text-sm ${selectedBatchSize === size ? "border-red-500 bg-red-600 text-white" : "border-zinc-700 text-zinc-200"}`}>Top {size}</button>)}
          <button type="button" onClick={() => onSelectBatchSize?.(preflight.maximumSafeReach)} disabled={preflight.maximumSafeReach === 0} className={`border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:text-zinc-600 ${selectedBatchSize === preflight.maximumSafeReach && selectedBatchSize > 0 ? "border-red-500 bg-red-600 text-white" : "border-zinc-700 text-zinc-200"}`}>Full Safe Reach ({preflight.maximumSafeReach})</button>
          <label className="flex items-center gap-2 text-sm text-zinc-300">Custom
            <input aria-label="Custom campaign size" type="number" min={1} max={Math.max(1, preflight.maximumSafeReach)} value={selectedBatchSize || ""} onChange={(event) => onSelectBatchSize?.(Number(event.target.value))} disabled={preflight.maximumSafeReach === 0} className="h-10 w-24 border border-zinc-700 bg-zinc-950 px-3 disabled:cursor-not-allowed disabled:text-zinc-600" />
          </label>
        </div>
      </section>

      <details className="border border-zinc-800 bg-zinc-950 p-4 text-sm">
        <summary className="cursor-pointer text-zinc-300">Technical details</summary>
        <div className="mt-3 grid gap-2 text-zinc-500 sm:grid-cols-2">
          <p>Target authority: {preflight.technicalDetails.targetAuthority}</p>
          <p>Source mode: {preflight.technicalDetails.sourceMode}</p>
          <p>Eligible target structures: {preflight.targets.length}</p>
          <p>Campaign ownership authority: {preflight.diagnostics.campaignAuthorityAvailable ? "AVAILABLE" : "UNAVAILABLE"}</p>
          <p>Broader intent authority: {preflight.diagnostics.broaderIntentAuthorityAvailable ? "AVAILABLE" : "UNAVAILABLE"}</p>
          <p>Diagnostic exact canonical conflicts: {preflight.diagnostics.exactCanonicalConflictCount}</p>
        </div>
      </details>

      <div className="flex flex-col items-start gap-2 border-t border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-400">{launchCapabilityAvailable ? "Launch will revalidate this exact target cohort before any runtime action." : launchCapabilityReason ?? "Campaign launch is unavailable for this runtime."}</p>
        <button type="button" onClick={onLaunch} disabled={!launchAvailable || launchBusy || selectedBatchSize < 1} className="min-h-11 border border-red-500 bg-red-600 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500">Launch Campaign</button>
      </div>
    </section>
  );
}

const ACTIVE_LAUNCH_STATES = new Set<GlwLaunchUiState>(["REVALIDATING", "CREATING_CAMPAIGN", "RESERVING_TARGETS", "REFERENCE_BOOTSTRAP", "STARTING"]);

export function CampaignLaunchpad({ organizationId, requestRoles, existingProducts = [], launchExecutionAvailable = false, atomicLaunchAvailable = false, launchCapabilityReason, launchAdapter }: Props) {
  const [reach, setReach] = useState<GlwCampaignReach>("NATIONWIDE");
  const [productUrl, setProductUrl] = useState("");
  const [selectedProductUrl, setSelectedProductUrl] = useState("");
  const [stateCodes, setStateCodes] = useState<string[]>([]);
  const [metro, setMetro] = useState("");
  const [preflight, setPreflight] = useState<GlwCampaignLaunchpadPreflight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedBatchSize, setSelectedBatchSize] = useState(0);
  const [launchState, setLaunchState] = useState<GlwLaunchUiState>("IDLE");
  const [launchRequest, setLaunchRequest] = useState<GlwCampaignLaunchRequest | null>(null);
  const [launchResult, setLaunchResult] = useState<GlwCampaignLaunchResult | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [syntheticScenario, setSyntheticScenario] = useState<GlwSyntheticLaunchScenario>("SUCCESS");
  const adapter = useMemo(() => launchAdapter ?? (atomicLaunchAvailable
    ? createConfiguredAtomicRuntimeCampaignLaunchAdapter({ organizationId, requestRoles })
    : launchExecutionAvailable
      ? createSyntheticCampaignLaunchAdapter({ scenario: syntheticScenario, delay: () => new Promise((resolve) => setTimeout(resolve, 350)) })
      : createDisabledCampaignLaunchAdapter()), [atomicLaunchAvailable, launchAdapter, launchExecutionAvailable, organizationId, requestRoles, syntheticScenario]);
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
      setSelectedBatchSize(body.preflight.readiness === "READY" ? body.preflight.recommendedInitialBatch : 0);
      setLaunchResult(null);
      setLaunchState("IDLE");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Campaign analysis failed.");
    } finally { setLoading(false); }
  }

  const safeTargets = preflight?.targetAssessments.filter((target) => target.safe && target.primaryDisposition === "SAFE") ?? [];
  const launchEligible = Boolean(
    preflight
    && !launchResult
    && preflight.readiness === "READY"
    && preflight.maximumSafeReach > 0
    && selectedBatchSize > 0
    && selectedBatchSize <= preflight.maximumSafeReach
    && selectedBatchSize <= safeTargets.length
    && preflight.publicationPolicy !== "UNAVAILABLE"
    && !preflight.readinessBlockers.some((blocker) => blocker.severity === "BLOCKING")
    && adapter.available
  );
  const launchBusy = ACTIVE_LAUNCH_STATES.has(launchState);

  function requestLaunch() {
    if (!preflight?.product || preflight.publicationPolicy === "UNAVAILABLE" || !launchEligible || launchBusy) return;
    const publicationPolicy = preflight.publicationPolicy;
    const selectedTargets = safeTargets.slice(0, selectedBatchSize).map((target) => ({ canonicalPath: target.canonicalPath, stateCode: target.stateCode, citySlug: target.citySlug, cityName: target.cityName }));
    const request: GlwCampaignLaunchRequest = {
      siteId: preflight.site.id,
      productId: preflight.product.id,
      campaignName: `${preflight.product.name} ${preflight.desiredReach.replaceAll("_", " ")} Cities`,
      pagesPerDay: Math.min(100, selectedBatchSize),
      targetClass: "CITY",
      reach: preflight.desiredReach,
      preflightInput: { reach, productUrl, stateCodes, metro },
      selectedBatchSize,
      selectedTargets,
      acknowledgedPublicationPolicy: publicationPolicy,
    };
    setLaunchRequest(request);
    setLaunchError(null);
    setLaunchState("CONFIRMING");
  }

  async function confirmLaunch() {
    if (!launchRequest || launchBusy) return;
    setLaunchError(null);
    try {
      const result = await adapter.launch(launchRequest, setLaunchState);
      setLaunchResult(result);
      setLaunchState(presentGlwLaunchResult(result).uiState);
    } catch (cause) {
      setLaunchError(cause instanceof Error ? cause.message : "Campaign launch failed.");
      setLaunchState("FAILED");
    }
  }

  function resetLaunchpad() {
    setReach("NATIONWIDE"); setProductUrl(""); setSelectedProductUrl(""); setStateCodes([]); setMetro("");
    setPreflight(null); setError(null); setSelectedBatchSize(0); setLaunchRequest(null); setLaunchResult(null); setLaunchError(null); setLaunchState("IDLE"); setSyntheticScenario("SUCCESS");
  }

  async function analyzeAgain() {
    setLaunchResult(null); setLaunchRequest(null); setLaunchError(null); setLaunchState("IDLE");
    await analyze();
  }

  return (
    <section className="border border-zinc-800 bg-zinc-950 p-5 md:p-7">
      <div className="space-y-8">
        <fieldset disabled={launchBusy}>
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
          <input id="campaign-product-url" disabled={launchBusy} type="url" inputMode="url" value={productUrl} onChange={(event) => { setProductUrl(event.target.value); setSelectedProductUrl(""); setPreflight(null); setError(null); }} placeholder="https://www.example.com/product/" aria-invalid={productUrl.length > 0 && !urlValid} className="mt-3 h-12 w-full border border-zinc-700 bg-zinc-900 px-4 text-white outline-none focus:border-red-500 disabled:opacity-50" />
          {productUrl && !urlValid ? <p className="mt-2 text-sm text-amber-300">Enter a valid HTTP or HTTPS product URL.</p> : null}
        </section>

        <section>
          <p className="text-xs uppercase tracking-[0.25em] text-red-400">3. Analyze</p>
          <button type="button" onClick={analyze} disabled={!urlValid || !reachValid || loading || launchBusy} className="mt-3 min-h-12 w-full bg-red-600 px-5 text-sm font-bold text-white transition enabled:hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 sm:w-auto">
            {loading ? "Analyzing campaign..." : "Analyze Campaign"}
          </button>
          {loading ? <p role="status" className="mt-3 text-sm text-zinc-400">Checking registered authority, existing coverage, and supported targets.</p> : null}
          {error ? <div role="alert" className="mt-4 border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}
        </section>

        {launchExecutionAvailable && !atomicLaunchAvailable ? (
          <details className="border border-cyan-700/40 bg-cyan-950/20 p-4 text-sm">
            <summary className="cursor-pointer text-cyan-200">Synthetic launch fixture</summary>
            <label className="mt-3 block text-zinc-300">Outcome<select aria-label="Synthetic launch outcome" value={syntheticScenario} onChange={(event) => setSyntheticScenario(event.target.value as GlwSyntheticLaunchScenario)} disabled={launchBusy} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white"><option value="SUCCESS">Success</option><option value="STALE_PREFLIGHT">Stale preflight</option><option value="TARGET_CONFLICT">Target conflict</option><option value="ALREADY_EXISTS">Already exists</option><option value="REFERENCE_REVIEW_REQUIRED">Reference review required</option><option value="RECOVERY_REQUIRED">Recovery required</option><option value="DISPATCH_FAILED">Dispatch failure after persistence</option></select></label>
            <p className="mt-2 text-xs text-cyan-300/70">Non-production UI fixture. No launch endpoint is called.</p>
          </details>
        ) : null}

        {preflight ? <CampaignPreflight preflight={preflight} selectedBatchSize={selectedBatchSize} onSelectBatchSize={(size) => setSelectedBatchSize(Math.max(0, Math.min(size, preflight.maximumSafeReach)))} onLaunch={requestLaunch} launchAvailable={launchEligible} launchCapabilityAvailable={adapter.available} launchCapabilityReason={launchCapabilityReason} launchBusy={launchBusy} /> : (
          <section className="border-t border-zinc-800 pt-6 text-sm text-zinc-500">Campaign preflight will appear here after analysis.</section>
        )}
        {launchBusy ? <CampaignLaunchProgress state={launchState} /> : null}
        {launchError ? <div role="alert" className="border border-red-500/50 bg-red-950/30 p-4 text-sm text-red-200">{launchError}</div> : null}
        {launchResult ? <CampaignLaunchOutcome result={launchResult} productName={preflight?.product?.name ?? "Unknown product"} reach={preflight?.desiredReach ?? reach} onAnalyzeAgain={analyzeAgain} onStartAnother={resetLaunchpad} /> : null}
      </div>
      {launchState === "CONFIRMING" && launchRequest && preflight?.product ? <CampaignLaunchConfirmation request={launchRequest} siteName={preflight.site.name} productName={preflight.product.name} maximumSafeReach={preflight.maximumSafeReach} onCancel={() => { setLaunchState("IDLE"); setLaunchRequest(null); }} onConfirm={confirmLaunch} /> : null}
    </section>
  );
}