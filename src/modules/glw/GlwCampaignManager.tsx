"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";
import type { GlwCampaign } from "./campaign-types";
import { GLW_CAMPAIGN_US_STATES } from "./campaign-geography";
import { GLW_CITIES } from "./page-generation";
import { GlwCampaignOperationsList } from "./GlwCampaignOperationsList";
import type { GlwCampaignListOperatorSummary } from "./campaign-list-operator-read-model";
import {
  createCityIdentityKey,
  resolveGlwCampaignGeography,
  type GlwCampaignGeographyMode,
  type GlwCityScopeMode,
} from "./campaign-targeting";

type SiteOption = { siteId: string; organizationId: string; displayName: string };
type ProductOption = { productId: string; organizationId: string; displayName: string; assignedSiteIds: readonly string[] };
type Props = { organizationId: string; siteId: string | null; sites: readonly SiteOption[]; products: readonly ProductOption[]; initialCampaigns: readonly GlwCampaign[]; initialOperatorSummaries: readonly GlwCampaignListOperatorSummary[] };

type DraftSnapshot = {
  selectedSiteId: string;
  productId: string;
  name: string;
  pagesPerDay: number;
  publicationPolicy: "draft_only" | "publish_after_gates";
  allStates?: boolean;
  geographyMode: GlwCampaignGeographyMode;
  selectedStateCodes: string[];
  selectedCityIdentities: string[];
  citiesByStateScope: GlwCityScopeMode;
  baselineProductIds: string[];
  createdAt: number;
};

type ApiProduct = {
  productId: string;
  organizationId: string;
  displayName: string;
  assignedSiteIds?: readonly string[];
  createdAt?: string;
};

function draftKey(organizationId: string): string {
  return `glw:new-campaign:draft:${organizationId}`;
}

function toProductOption(product: ApiProduct): ProductOption {
  return {
    productId: product.productId,
    organizationId: product.organizationId,
    displayName: product.displayName,
    assignedSiteIds: product.assignedSiteIds ?? [],
  };
}

const GEOGRAPHY_MODE_OPTIONS: Array<{ value: GlwCampaignGeographyMode; label: string }> = [
  { value: "ALL_STATES", label: "All 50 U.S. States" },
  { value: "SELECTED_STATES", label: "Selected States" },
  { value: "CITIES_BY_STATE", label: "Cities in State(s)" },
  { value: "SELECTED_CITIES", label: "Selected Cities" },
];

export function GlwCampaignManager({ organizationId, siteId, sites, products, initialCampaigns, initialOperatorSummaries }: Props) {
  const initialSiteId = siteId ?? sites[0]?.siteId ?? "";
  const [selectedSiteId, setSelectedSiteId] = useState(initialSiteId);
  const selectedSite = useMemo(() => sites.find((site) => site.siteId === selectedSiteId) ?? null, [selectedSiteId, sites]);
  const canonicalScopeOrganizationId = selectedSite?.organizationId ?? organizationId;
  const canonicalScopeSiteId = selectedSite?.siteId ?? selectedSiteId;
  const [localProducts, setLocalProducts] = useState<readonly ProductOption[]>(products);
  const availableProducts = useMemo(() => localProducts.filter((product) => product.organizationId === organizationId && product.assignedSiteIds.includes(selectedSiteId)), [organizationId, localProducts, selectedSiteId]);
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [pagesPerDay, setPagesPerDay] = useState(10);
  const [publicationPolicy, setPublicationPolicy] = useState<"draft_only" | "publish_after_gates">("publish_after_gates");
  const [geographyMode, setGeographyMode] = useState<GlwCampaignGeographyMode>("ALL_STATES");
  const [stateSearch, setStateSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [selectedStateCodes, setSelectedStateCodes] = useState<readonly string[]>([]);
  const [selectedCityIdentities, setSelectedCityIdentities] = useState<readonly string[]>([]);
  const [citiesByStateScope, setCitiesByStateScope] = useState<GlwCityScopeMode>("ALL_SUPPORTED");
  const [campaigns, setCampaigns] = useState<readonly GlwCampaign[]>(initialCampaigns);
  const [operatorSummaries, setOperatorSummaries] = useState<readonly GlwCampaignListOperatorSummary[]>(initialOperatorSummaries);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const workspaceRef = useRef(`${organizationId}::${initialSiteId}`);

  const stateOptions = useMemo(() => GLW_CAMPAIGN_US_STATES.map((state) => ({
    code: state.code,
    name: state.name,
    label: `${state.code} - ${state.name}`,
  })), []);
  const selectedStateSet = useMemo(() => new Set(selectedStateCodes), [selectedStateCodes]);
  const cityOptions = useMemo(() => {
    const cities = geographyMode === "SELECTED_CITIES"
      ? GLW_CITIES
      : GLW_CITIES.filter((city) => selectedStateSet.has(city.stateCode));
    return cities.map((city) => ({
      identity: createCityIdentityKey({ stateCode: city.stateCode, citySlug: city.slug }),
      stateCode: city.stateCode,
      citySlug: city.slug,
      cityName: city.name,
      label: `${city.name}, ${city.stateCode}`,
    }));
  }, [geographyMode, selectedStateSet]);

  const filteredStateOptions = useMemo(() => {
    const query = stateSearch.trim().toLowerCase();
    if (!query) {
      return stateOptions;
    }
    return stateOptions.filter((state) => state.code.toLowerCase().includes(query) || state.name.toLowerCase().includes(query));
  }, [stateOptions, stateSearch]);

  const filteredCityOptions = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!query) {
      return cityOptions;
    }
    return cityOptions.filter((city) => city.cityName.toLowerCase().includes(query) || city.stateCode.toLowerCase().includes(query));
  }, [cityOptions, citySearch]);

  const resolvedGeography = useMemo(() => resolveGlwCampaignGeography({
    mode: geographyMode,
    selectedStateCodes,
    selectedCityIdentities,
    citiesByStateScope,
  }), [geographyMode, selectedStateCodes, selectedCityIdentities, citiesByStateScope]);

  async function refreshProductsWithSelection(input?: { baselineProductIds?: readonly string[]; preferredSiteId?: string }): Promise<string | null> {
    setSyncingProducts(true);
    try {
      const scopedSiteId = input?.preferredSiteId ?? canonicalScopeSiteId;
      const response = await fetch("/api/products", {
        method: "GET",
        headers: operatorMutationHeaders({ "x-gcp-roles": "ops_manager", "x-gcp-organization-id": canonicalScopeOrganizationId, ...(scopedSiteId ? { "x-gcp-site-id": scopedSiteId } : {}) }),
        cache: "no-store",
      });

      const payload = (await response.json()) as { products?: ApiProduct[]; error?: string };
      if (!response.ok || !payload.products) {
        throw new Error(payload.error ?? "Unable to refresh products.");
      }

      const nextProducts = payload.products.map((product) => toProductOption(product));
      setLocalProducts(nextProducts);

      if (!input?.baselineProductIds || input.baselineProductIds.length === 0) {
        return null;
      }

      const baseline = new Set(input.baselineProductIds);
      const preferredSiteId = scopedSiteId;
      const createdCandidates = payload.products
        .filter((product) => !baseline.has(product.productId))
        .filter((product) => (product.assignedSiteIds ?? []).includes(preferredSiteId));

      if (createdCandidates.length === 0) {
        return null;
      }

      const newest = createdCandidates.sort((left, right) => {
        const leftTime = Date.parse(left.createdAt ?? "");
        const rightTime = Date.parse(right.createdAt ?? "");
        return Number.isFinite(rightTime) ? rightTime - (Number.isFinite(leftTime) ? leftTime : 0) : -1;
      })[0];

      setProductId(newest.productId);
      setMessage(`Selected newly created product: ${newest.displayName}.`);
      return newest.productId;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to refresh products.");
      return null;
    } finally {
      setSyncingProducts(false);
    }
  }

  function saveDraftSnapshot(): DraftSnapshot {
    const snapshot: DraftSnapshot = {
      selectedSiteId,
      productId,
      name,
      pagesPerDay,
      publicationPolicy,
      geographyMode,
      selectedStateCodes: [...selectedStateCodes],
      selectedCityIdentities: [...selectedCityIdentities],
      citiesByStateScope,
      baselineProductIds: localProducts.map((product) => product.productId),
      createdAt: Date.now(),
    };

    sessionStorage.setItem(draftKey(organizationId), JSON.stringify(snapshot));
    return snapshot;
  }

  useEffect(() => {
    const nextInitialSiteId = siteId ?? sites[0]?.siteId ?? "";
    const nextWorkspace = `${organizationId}::${nextInitialSiteId}`;
    if (workspaceRef.current === nextWorkspace) {
      return;
    }

    workspaceRef.current = nextWorkspace;
    const fallbackSiteId = sites.some((site) => site.siteId === nextInitialSiteId)
      ? nextInitialSiteId
      : (sites[0]?.siteId ?? "");

    setSelectedSiteId(fallbackSiteId);
    setLocalProducts(products);
    setCampaigns(initialCampaigns);
    setOperatorSummaries(initialOperatorSummaries);
    setProductId("");
    setName("");
    setPagesPerDay(10);
    setPublicationPolicy("publish_after_gates");
    setGeographyMode("ALL_STATES");
    setStateSearch("");
    setCitySearch("");
    setSelectedStateCodes([]);
    setSelectedCityIdentities([]);
    setCitiesByStateScope("ALL_SUPPORTED");
    setMessage(null);
  }, [organizationId, siteId, sites, products, initialCampaigns, initialOperatorSummaries]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = sessionStorage.getItem(draftKey(organizationId));
    if (!raw) {
      return;
    }

    let snapshot: DraftSnapshot | null = null;
    try {
      snapshot = JSON.parse(raw) as DraftSnapshot;
    } catch {
      sessionStorage.removeItem(draftKey(organizationId));
      return;
    }

    const maxDraftAgeMs = 30 * 60 * 1000;
    if (!snapshot || Date.now() - snapshot.createdAt > maxDraftAgeMs) {
      sessionStorage.removeItem(draftKey(organizationId));
      return;
    }

    const restoredSite = sites.find((site) => site.siteId === snapshot.selectedSiteId) ?? null;
    setSelectedSiteId(restoredSite?.siteId ?? initialSiteId);
    setProductId(snapshot.productId);
    setName(snapshot.name);
    setPagesPerDay(snapshot.pagesPerDay);
    setPublicationPolicy(snapshot.publicationPolicy);
    setGeographyMode(snapshot.geographyMode ?? (snapshot.allStates ? "ALL_STATES" : "SELECTED_STATES"));
    setSelectedStateCodes(snapshot.selectedStateCodes ?? []);
    setSelectedCityIdentities(snapshot.selectedCityIdentities ?? []);
    setCitiesByStateScope(snapshot.citiesByStateScope ?? "ALL_SUPPORTED");
    setMessage("Restored draft form state.");

    void refreshProductsWithSelection({
      baselineProductIds: snapshot.baselineProductIds,
      preferredSiteId: snapshot.selectedSiteId,
    });

    sessionStorage.removeItem(draftKey(organizationId));
    // We only want to restore once on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSiteId, organizationId, sites]);

  function openProductAuthorityWorkspace(): void {
    if (!selectedSiteId) {
      setMessage("Choose a site before adding a new product or service.");
      return;
    }

    const snapshot = saveDraftSnapshot();
    const currentUrl = `${window.location.pathname}?${new URLSearchParams({ organizationId, siteId: selectedSiteId }).toString()}`;
    const addProductUrl = `/products/new?organizationId=${encodeURIComponent(organizationId)}&siteId=${encodeURIComponent(selectedSiteId)}&source=manual&returnTo=${encodeURIComponent(currentUrl)}`;
    const popup = window.open(addProductUrl, "_blank", "noopener,noreferrer,width=1280,height=900");

    if (!popup) {
      window.location.href = addProductUrl;
      return;
    }

    setMessage("Product workspace opened in a new tab. Complete creation there, then close that tab to continue here.");

    const intervalId = window.setInterval(() => {
      if (!popup.closed) {
        return;
      }

      window.clearInterval(intervalId);
      void refreshProductsWithSelection({
        baselineProductIds: snapshot.baselineProductIds,
        preferredSiteId: snapshot.selectedSiteId,
      });
    }, 1200);
  }

  async function createCampaign() {
    setSaving(true); setMessage(null);
    if (!selectedSite) {
      setMessage("Selected site is not valid in the current workspace scope. Re-select site and try again.");
      setSaving(false);
      return;
    }

    if (resolvedGeography.targets.length === 0) {
      setMessage("Select at least one valid geography target before saving.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/glw/campaigns", {
      method: "POST",
      headers: operatorMutationHeaders({ "Content-Type": "application/json", "x-gcp-roles": "platform_admin", "x-gcp-organization-id": canonicalScopeOrganizationId, ...(canonicalScopeSiteId ? { "x-gcp-site-id": canonicalScopeSiteId } : {}) }),
      body: JSON.stringify({ organizationId: canonicalScopeOrganizationId, siteId: canonicalScopeSiteId, productId, name, pageType: resolvedGeography.pageType, stateCodes: resolvedGeography.stateCodes, ...(resolvedGeography.pageType === "city_service" ? { cityTargets: resolvedGeography.cityTargets } : {}), pagesPerDay, publicationPolicy, imageRequired: true }),
    });
    const payload = (await response.json()) as { campaign?: GlwCampaign; errors?: string[]; error?: string };
    if (!response.ok || !payload.campaign) { setMessage(payload.errors?.join(" ") ?? payload.error ?? "Unable to create campaign."); setSaving(false); return; }
    setCampaigns((current) => [payload.campaign!, ...current]); setName(""); setProductId(""); setMessage("Campaign saved as draft. Refreshing operator state..."); window.location.reload();
  }

  function toggleState(stateCode: string): void {
    setSelectedStateCodes((current) => current.includes(stateCode)
      ? current.filter((code) => code !== stateCode)
      : [...current, stateCode].sort());
  }

  function toggleCity(identity: string): void {
    setSelectedCityIdentities((current) => current.includes(identity)
      ? current.filter((value) => value !== identity)
      : [...current, identity].sort());
  }

  function selectAllFilteredStates(): void {
    setSelectedStateCodes((current) => Array.from(new Set([...current, ...filteredStateOptions.map((state) => state.code)])).sort());
  }

  function clearAllStates(): void {
    setSelectedStateCodes([]);
  }

  function selectAllFilteredCities(): void {
    setSelectedCityIdentities((current) => Array.from(new Set([...current, ...filteredCityOptions.map((city) => city.identity)])).sort());
  }

  function clearAllCities(): void {
    setSelectedCityIdentities([]);
  }

  return <div className="space-y-6">
    <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.3em] text-red-400">GLW Campaign Manager</p>
      <h1 className="mt-3 text-3xl font-black text-white">Production Campaigns</h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-300">Configure the campaign, attach source material, generate a reference page, and approve it before production activation.</p></div><Link href="/glw/campaigns?scope=all" className="border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-red-500">View all sites</Link></div>
    </header>
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">New Campaign</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-zinc-300">Site<select value={selectedSiteId} onChange={(event) => {
            const nextSiteId = event.target.value;

            setSelectedSiteId(nextSiteId);
            setProductId("");

            const params = new URLSearchParams(window.location.search);
            params.set("organizationId", organizationId);
            params.set("siteId", nextSiteId);

            window.location.href =
              `${window.location.pathname}?${params.toString()}`;
          }} className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white">{sites.map((site) => <option key={site.siteId} value={site.siteId}>{site.displayName}</option>)}</select></label>
          <div>
            <label className="text-sm text-zinc-300">Product / Service<select value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white"><option value="">Select product</option>{availableProducts.map((product) => <option key={product.productId} value={product.productId}>{product.displayName}</option>)}</select></label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={openProductAuthorityWorkspace} className="rounded-lg border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-500 hover:text-white">+ Add New Product / Service</button>
              <Link href="/products" target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-red-500 hover:text-white">Manage Products</Link>
              <button type="button" disabled={syncingProducts} onClick={() => { void refreshProductsWithSelection(); }} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-red-500 hover:text-white disabled:opacity-50">{syncingProducts ? "Refreshing..." : "Refresh products"}</button>
            </div>
          </div>
          <label className="text-sm text-zinc-300 md:col-span-2">Campaign Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Indoor LED Sphere - 50 State Overview" className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
          <label className="text-sm text-zinc-300">Geography Mode<select value={geographyMode} onChange={(event) => {
            const nextMode = event.target.value as GlwCampaignGeographyMode;
            setGeographyMode(nextMode);
            if (nextMode === "ALL_STATES") {
              setSelectedStateCodes([]);
              setSelectedCityIdentities([]);
            }
            if (nextMode === "SELECTED_STATES") {
              setSelectedCityIdentities([]);
            }
            if (nextMode === "SELECTED_CITIES") {
              setSelectedStateCodes([]);
              setCitiesByStateScope("SELECTED");
            }
          }} className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white">{GEOGRAPHY_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="text-sm text-zinc-300">Pages per day<input type="number" min={1} max={100} value={pagesPerDay} onChange={(event) => setPagesPerDay(Number(event.target.value))} className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
          <label className="text-sm text-zinc-300 md:col-span-2">Publication Policy<select value={publicationPolicy} onChange={(event) => setPublicationPolicy(event.target.value as "draft_only" | "publish_after_gates")} className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white"><option value="publish_after_gates">Auto-publish only after all gates pass</option><option value="draft_only">Draft only</option></select></label>

          {(geographyMode === "SELECTED_STATES" || geographyMode === "CITIES_BY_STATE") ? <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">State selection</p><div className="mt-3 flex flex-wrap items-center gap-2"><input value={stateSearch} onChange={(event) => setStateSearch(event.target.value)} placeholder="Search states" className="h-10 min-w-[220px] flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white" /><button type="button" onClick={selectAllFilteredStates} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-red-500 hover:text-white">Select All</button><button type="button" onClick={clearAllStates} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-red-500 hover:text-white">Clear All</button><span className="text-xs text-zinc-400">Selected: {selectedStateCodes.length}</span></div><div className="mt-3 max-h-[24rem] overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 md:max-h-[28rem]"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredStateOptions.map((state) => {
            const selected = selectedStateCodes.includes(state.code);
            return <label key={state.code} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${selected ? "border-red-500/60 bg-red-500/15 text-white" : "border-zinc-800 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/60"}`}><input type="checkbox" checked={selected} onChange={() => toggleState(state.code)} className="h-4 w-4 cursor-pointer accent-red-500" /><span className="flex min-w-0 items-baseline gap-2"><strong className="font-bold tracking-wide text-zinc-100">{state.code}</strong><span className={`${selected ? "text-zinc-300" : "text-zinc-500"}`}>-</span><span className={`${selected ? "text-zinc-100" : "text-zinc-300"}`}>{state.name}</span></span></label>;
          })}</div></div></div> : null}

          {geographyMode === "CITIES_BY_STATE" ? <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><label className="text-sm text-zinc-300">City Scope<select value={citiesByStateScope} onChange={(event) => setCitiesByStateScope(event.target.value as GlwCityScopeMode)} className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-white"><option value="ALL_SUPPORTED">All supported cities in selected state(s)</option><option value="SELECTED">Choose specific cities</option></select></label>{citiesByStateScope === "SELECTED" ? <div className="mt-3"><div className="flex flex-wrap items-center gap-2"><input value={citySearch} onChange={(event) => setCitySearch(event.target.value)} placeholder="Search cities" className="h-10 min-w-[220px] flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white" /><button type="button" onClick={selectAllFilteredCities} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-red-500 hover:text-white">Select All</button><button type="button" onClick={clearAllCities} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-red-500 hover:text-white">Clear All</button><span className="text-xs text-zinc-400">Selected: {selectedCityIdentities.length}</span></div><div className="mt-3 max-h-52 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">{filteredCityOptions.map((city) => <label key={city.identity} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-zinc-200 hover:bg-zinc-800/50"><input type="checkbox" checked={selectedCityIdentities.includes(city.identity)} onChange={() => toggleCity(city.identity)} /><span>{city.label}</span></label>)}</div></div> : null}</div> : null}

          {geographyMode === "SELECTED_CITIES" ? <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Selected cities</p><div className="mt-3 flex flex-wrap items-center gap-2"><input value={citySearch} onChange={(event) => setCitySearch(event.target.value)} placeholder="Search cities" className="h-10 min-w-[220px] flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white" /><button type="button" onClick={selectAllFilteredCities} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-red-500 hover:text-white">Select All</button><button type="button" onClick={clearAllCities} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-red-500 hover:text-white">Clear All</button><span className="text-xs text-zinc-400">Selected: {selectedCityIdentities.length}</span></div><div className="mt-3 max-h-52 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">{filteredCityOptions.map((city) => <label key={city.identity} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-zinc-200 hover:bg-zinc-800/50"><input type="checkbox" checked={selectedCityIdentities.includes(city.identity)} onChange={() => toggleCity(city.identity)} /><span>{city.label}</span></label>)}</div></div> : null}

          <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Resolved target preview</p><div className="mt-2 flex justify-between"><span>Geography mode</span><strong className="text-white">{geographyMode}</strong></div><div className="mt-2 flex justify-between"><span>Resolved target type</span><strong className="text-white">{resolvedGeography.targetType}</strong></div><div className="mt-2 flex justify-between"><span>Targets</span><strong className="text-white">{resolvedGeography.targets.length}</strong></div><details className="mt-3"><summary className="cursor-pointer text-xs font-semibold uppercase text-zinc-300">View Resolved Targets</summary><ul className="mt-2 max-h-48 space-y-1 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">{resolvedGeography.targets.length === 0 ? <li>No targets selected.</li> : resolvedGeography.targets.map((target) => <li key={target.identity}>{target.label}</li>)}</ul></details>{geographyMode === "CITIES_BY_STATE" || geographyMode === "SELECTED_CITIES" ? <p className="mt-3 text-xs text-amber-300">Miles From a Location, counties, ZIP codes, and metro-area targeting are not enabled because authoritative coordinates and dedicated canonical registries are not currently available in GLW campaign creation.</p> : null}</div>
        </div>
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300"><div className="flex justify-between"><span>Targets</span><strong className="text-white">{resolvedGeography.targets.length}</strong></div><div className="mt-2 flex justify-between"><span>Page type</span><strong className="text-white">{resolvedGeography.pageType === "state_service" ? "State campaign" : "City campaign"}</strong></div><div className="mt-2 flex justify-between"><span>Minimum daily throughput</span><strong className="text-white">{pagesPerDay}</strong></div><div className="mt-2 flex justify-between"><span>Image required</span><strong className="text-white">Yes</strong></div></div>
        {message ? <p className="mt-4 text-sm text-amber-300">{message}</p> : null}
        <button type="button" disabled={saving || !canonicalScopeSiteId || !selectedSite || !productId || !name.trim() || resolvedGeography.targets.length < 1} onClick={createCampaign} className="mt-5 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Saving..." : "Save Campaign Draft"}</button>
      </div>
      <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">Existing Campaigns</h2>
        <p className="mt-1 text-sm text-zinc-400">Review current campaigns and open their control surfaces.</p>
        <div className="mt-4">
        {campaigns.length === 0 ? <p className="text-sm text-zinc-400">No campaigns configured yet.</p> : <GlwCampaignOperationsList summaries={operatorSummaries} />}
        </div>
      </div>
    </section>
  </div>;
}
