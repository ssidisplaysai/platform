"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CompanyRepository } from "@/core/repositories/CompanyRepository";
import { findFreshSiteCollision, type FreshSiteCollision } from "./fresh-site-create-mode";
import { createSiteId, slugifySiteName } from "./site-identity";
import type {
  IntegrationProfileConfiguration,
  IntegrationProfileType,
  NewSiteInput,
  SiteConfiguration,
  SiteEnvironment,
  SitePrimaryAddress,
  SitePublicationPolicy,
  SiteReadinessResult,
} from "./types";
import type {
  FreshSiteCompletionState,
  FreshSiteInventory,
  IntegrationRequirement,
} from "./fresh-site-onboarding";
import type { PublicWordPressPreflightResult } from "./wordpress-public-preflight";

type Step = 1 | 2 | 3 | 4 | 5;
type Assessment = {
  inventory: FreshSiteInventory;
  requirements: IntegrationRequirement[];
  readiness: SiteReadinessResult;
  completionState: FreshSiteCompletionState;
  complexity: "LOW" | "MODERATE";
  effort: "LOW" | "MODERATE";
};

const STEPS: Array<[Step, string]> = [
  [1, "Site Details"],
  [2, "Location"],
  [3, "WordPress"],
  [4, "Connect"],
  [5, "Complete"],
];

const PROFILE_FIELDS: Array<{
  type: IntegrationProfileType;
  label: string;
  field: "promptProfileReference" | "imageProfileReference" | "seoProfileReference" | "brandProfileReference";
}> = [
  { type: "seo", label: "SEO profile", field: "seoProfileReference" },
  { type: "prompt", label: "Prompt profile", field: "promptProfileReference" },
  { type: "image", label: "Image profile", field: "imageProfileReference" },
  { type: "brand", label: "Brand profile", field: "brandProfileReference" },
];

function headers(organizationId: string, siteId?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-gcp-roles": "ops_manager",
    "x-gcp-organization-id": organizationId,
    ...(siteId ? { "x-gcp-site-id": siteId } : {}),
  };
}

function normalizedDomain(value: string): string {
  return value.trim().replace(/^https:\/\//i, "").replace(/\/$/, "").toLowerCase();
}

export function FreshSiteOnboardingFlow() {
  const organizations = CompanyRepository.getActive();
  const [step, setStep] = useState<Step>(1);
  const [intent, setIntent] = useState<"fresh" | "existing">("fresh");
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [siteName, setSiteName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [domain, setDomain] = useState("");
  const [environment, setEnvironment] = useState<SiteEnvironment>("production");
  const [primaryAddress, setPrimaryAddress] = useState<SitePrimaryAddress>({
    addressLine1: "",
    addressLine2: null,
    city: "",
    stateRegion: "",
    postalCode: "",
    countryCode: "US",
  });
  const [advanced, setAdvanced] = useState(false);
  const [apiOverride, setApiOverride] = useState("");
  const [preflight, setPreflight] = useState<PublicWordPressPreflightResult | null>(null);
  const [site, setSite] = useState<SiteConfiguration | null>(null);
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");
  const [credentialsStored, setCredentialsStored] = useState(false);
  const [profiles, setProfiles] = useState<IntegrationProfileConfiguration[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState({
    seoProfileReference: "",
    promptProfileReference: "",
    imageProfileReference: "",
    brandProfileReference: "",
    workflowReference: "",
  });
  const [publicationPolicy, setPublicationPolicy] = useState<SitePublicationPolicy>("draft_only");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collision, setCollision] = useState<FreshSiteCollision | null>(null);

  const slug = useMemo(() => slugifySiteName(siteName), [siteName]);
  const prospectiveSiteId = organizationId && slug ? createSiteId(organizationId, slug) : "Generated after site name";
  const cleanDomain = normalizedDomain(domain);
  const inferredApiUrl = cleanDomain ? `https://${cleanDomain}/wp-json/wp/v2` : "";

  useEffect(() => {
    let cancelled = false;
    async function loadProfiles() {
      if (!organizationId) return;
      try {
        const response = await fetch(`/api/profiles?organizationId=${encodeURIComponent(organizationId)}&enabled=true`, {
          headers: headers(organizationId),
          cache: "no-store",
        });
        const payload = (await response.json()) as { profiles?: IntegrationProfileConfiguration[] };
        if (!cancelled && response.ok) setProfiles(payload.profiles ?? []);
      } catch {
        if (!cancelled) setProfiles([]);
      }
    }
    void loadProfiles();
    return () => { cancelled = true; };
  }, [organizationId]);

  function resetEvidence() {
    setPreflight(null);
    setSite(null);
    setCredentialsStored(false);
    setAssessment(null);
    setCollision(null);
    setStep(1);
  }

  async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const payload = (await response.json()) as T & { error?: string; issues?: Array<{ message?: string }> };
    if (!response.ok) {
      throw new Error(payload.error ?? payload.issues?.map((issue) => issue.message).filter(Boolean).join(" ") ?? `Request failed (${response.status}).`);
    }
    return payload;
  }

  async function runPreflight() {
    setBusy("preflight");
    setError(null);
    setPreflight(null);
    setCollision(null);
    try {
      const sitesPayload = await requestJson<{ sites: SiteConfiguration[] }>("/api/sites", {
        method: "GET",
        headers: headers(organizationId),
        cache: "no-store",
      });
      const existing = findFreshSiteCollision({
        sites: sitesPayload.sites,
        prospectiveSiteId,
        domain: cleanDomain,
      });
      if (existing) {
        setCollision(existing);
        return;
      }
      const payload = await requestJson<{ result: PublicWordPressPreflightResult }>("/api/sites/onboarding-preflight", {
        method: "POST",
        headers: headers(organizationId),
        body: JSON.stringify({ domain, apiBaseUrl: advanced ? apiOverride : null, intent }),
      });
      setPreflight(payload.result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Public preflight failed.");
    } finally {
      setBusy(null);
    }
  }

  async function createShell() {
    if (!preflight?.ready) return;
    setBusy("create");
    setError(null);
    const input: NewSiteInput & { onboardingIntent: "fresh"; wordpressApiOverride: string | null } = {
      organizationId,
      siteName: siteName.trim(),
      displayName: displayName.trim(),
      slug,
      domain: preflight.domain,
      canonicalUrl: preflight.canonicalUrl,
      primaryAddress,
      environment,
      enabled: false,
      publicationPolicy: "draft_only",
      defaultContentType: "article",
      defaultPublicationStatus: "draft",
      defaultAuthorReference: null,
      defaultCategoryReferences: [],
      integrations: {
        wordpressApiBaseUrl: preflight.apiBaseUrl,
        wordpressCredentialReference: null,
        workflowReference: null,
      },
      profiles: {
        promptProfileReference: null,
        imageProfileReference: null,
        seoProfileReference: null,
        brandProfileReference: null,
        analyticsProfileReference: null,
      },
      notes: "Fresh WordPress onboarding through GLW.",
      onboardingIntent: "fresh",
      wordpressApiOverride: advanced ? apiOverride : null,
    };
    try {
      const payload = await requestJson<{ site: SiteConfiguration }>("/api/sites/onboarding-create", {
        method: "POST",
        headers: headers(organizationId),
        body: JSON.stringify(input),
      });
      setSite(payload.site);
      setStep(2);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Site shell creation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function saveLocation() {
    if (!site) return;
    setBusy("location");
    setError(null);
    try {
      const payload = await requestJson<{ site: SiteConfiguration }>(`/api/sites/${encodeURIComponent(site.siteId)}`, {
        method: "PATCH",
        headers: headers(organizationId, site.siteId),
        body: JSON.stringify({ primaryAddress }),
      });
      setSite(payload.site);
      setStep(3);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Location could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function storeCredentials() {
    if (!site) return;
    setBusy("credentials");
    setError(null);
    try {
      await requestJson<{ configured: boolean }>(`/api/sites/${encodeURIComponent(site.siteId)}/wordpress-credentials`, {
        method: "PUT",
        headers: headers(organizationId, site.siteId),
        body: JSON.stringify({ username, applicationPassword }),
      });
      setUsername("");
      setApplicationPassword("");
      setCredentialsStored(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Credential storage failed.");
    } finally {
      setBusy(null);
    }
  }

  async function assessConnection(nextStep: Step = 3) {
    if (!site) return;
    setBusy("assessment");
    setError(null);
    try {
      const payload = await requestJson<{ site: SiteConfiguration; assessment: Assessment }>(`/api/sites/${encodeURIComponent(site.siteId)}/onboarding-assessment`, {
        method: "POST",
        headers: headers(organizationId, site.siteId),
      });
      setSite(payload.site);
      setAssessment(payload.assessment);
      setStep(nextStep);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authenticated assessment failed.");
    } finally {
      setBusy(null);
    }
  }

  function profilesOfType(type: IntegrationProfileType) {
    return profiles.filter((profile) => profile.profileType === type && profile.status === "active" && profile.enabled);
  }

  async function saveConfiguration() {
    if (!site) return;
    setBusy("configuration");
    setError(null);
    try {
      const payload = await requestJson<{ site: SiteConfiguration }>(`/api/sites/${encodeURIComponent(site.siteId)}`, {
        method: "PATCH",
        headers: headers(organizationId, site.siteId),
        body: JSON.stringify({
          publicationPolicy,
          integrations: { ...site.integrations, workflowReference: selectedProfiles.workflowReference || null },
          profiles: {
            ...site.profiles,
            seoProfileReference: selectedProfiles.seoProfileReference || null,
            promptProfileReference: selectedProfiles.promptProfileReference || null,
            imageProfileReference: selectedProfiles.imageProfileReference || null,
            brandProfileReference: selectedProfiles.brandProfileReference || null,
          },
        }),
      });
      setSite(payload.site);
      await assessConnection(5);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Configuration could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  const identityReady = intent === "fresh" && Boolean(siteName.trim() && displayName.trim() && organizationId && cleanDomain);
  const configurationComplete = Object.values(selectedProfiles).every(Boolean);

  return (
    <section id="fresh-site-onboarding" className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <header className="border-b border-zinc-800 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">Genesis Site Studio</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Add New Site</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">Connect a fresh WordPress installation, verify its technical authority, and prepare it for product onboarding.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/sites" className="border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-red-500 hover:text-white">Back to Sites</Link>
            {site ? <span className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">{site.siteId}</span> : null}
          </div>
        </div>
        <nav className="mt-6 grid grid-cols-5 gap-1" aria-label="Onboarding progress">
          {STEPS.map(([number, label]) => (
            <button key={number} type="button" disabled={number > step} onClick={() => setStep(number)} className={`min-w-0 border-b-2 px-1 py-3 text-xs font-semibold ${step === number ? "border-red-500 text-white" : number < step ? "border-emerald-600 text-emerald-300" : "border-zinc-800 text-zinc-500"}`}>
              <span className="block">0{number}</span><span className="mt-1 block text-[10px] sm:text-xs">{label}</span>
            </button>
          ))}
        </nav>
      </header>

      <div className="p-5 sm:p-6">
        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Site identity</h3>
              <div className="mt-3 inline-flex border border-zinc-700 bg-zinc-900 p-1" role="group" aria-label="Onboarding intent">
                <button type="button" onClick={() => { setIntent("fresh"); resetEvidence(); }} className={`px-4 py-2 text-sm ${intent === "fresh" ? "bg-red-600 text-white" : "text-zinc-300"}`}>Fresh WordPress Site</button>
                <button type="button" onClick={() => { setIntent("existing"); resetEvidence(); }} className={`px-4 py-2 text-sm ${intent === "existing" ? "bg-red-600 text-white" : "text-zinc-300"}`}>Existing WordPress Site</button>
              </div>
              {intent === "existing" ? <p className="mt-3 border-l-2 border-amber-500 pl-3 text-sm text-amber-200">Existing-site integration assessment is planned but is not certified in V1. Choose Fresh WordPress Site to continue.</p> : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-zinc-300">Organization<select value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); resetEvidence(); }} className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white">{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
              <label className="text-sm text-zinc-300">Environment<select value={environment} onChange={(event) => { setEnvironment(event.target.value as SiteEnvironment); resetEvidence(); }} className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white"><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></label>
              <label className="text-sm text-zinc-300">Site Name<input required value={siteName} onChange={(event) => { setSiteName(event.target.value); resetEvidence(); }} placeholder="Example Fresh Site" className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white outline-none focus:border-red-500" /></label>
              <label className="text-sm text-zinc-300">Display Name<input required value={displayName} onChange={(event) => { setDisplayName(event.target.value); resetEvidence(); }} placeholder="Example Fresh Site" className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white outline-none focus:border-red-500" /></label>
              <label className="text-sm text-zinc-300 md:col-span-2">Domain<input required value={domain} onChange={(event) => { setDomain(event.target.value); setPreflight(null); setCollision(null); }} placeholder="example.com" inputMode="url" className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white outline-none focus:border-red-500" /></label>
            </div>
            <button type="button" onClick={() => setAdvanced((current) => !current)} className="text-sm font-semibold text-zinc-300 underline decoration-zinc-600 underline-offset-4">{advanced ? "Hide advanced endpoints" : "Advanced endpoint override"}</button>
            {advanced ? <label className="block text-sm text-zinc-300">WordPress REST API URL<input value={apiOverride} onChange={(event) => { setApiOverride(event.target.value); setPreflight(null); }} placeholder={inferredApiUrl} className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white outline-none focus:border-red-500" /></label> : null}
            <dl className="grid gap-3 border border-zinc-800 bg-zinc-900/50 p-4 text-xs sm:grid-cols-3">
              <div><dt className="text-zinc-500">Generated Site ID</dt><dd className="mt-1 break-all text-zinc-200">{prospectiveSiteId}</dd></div>
              <div><dt className="text-zinc-500">WordPress Admin</dt><dd className="mt-1 break-all text-zinc-200">{cleanDomain ? `https://${cleanDomain}/wp-admin` : "Inferred from domain"}</dd></div>
              <div><dt className="text-zinc-500">REST API</dt><dd className="mt-1 break-all text-zinc-200">{advanced && apiOverride ? apiOverride : inferredApiUrl || "Inferred from domain"}</dd></div>
            </dl>
            {preflight ? <PreflightPanel result={preflight} /> : null}
            {collision ? <section className="border border-amber-700 bg-amber-950/20 p-4"><p className="text-xs font-semibold text-amber-300">SITE_ALREADY_EXISTS</p><p className="mt-2 text-sm text-zinc-200">{collision.displayName} already owns {collision.domain ?? "this site identity"}. The create form remains unchanged.</p><Link href={`/sites/${encodeURIComponent(collision.siteId)}`} className="mt-3 inline-block text-sm font-semibold text-amber-200 underline underline-offset-4">Open existing site configuration</Link></section> : null}
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" disabled={!identityReady || busy !== null} onClick={runPreflight} className="border border-zinc-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy === "preflight" ? "Checking..." : "Run Public Preflight"}</button>
              <button type="button" disabled={!preflight?.ready || busy !== null} onClick={createShell} className="bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy === "create" ? "Creating..." : "Create Safe Site Shell"}</button>
            </div>
          </div>
        ) : null}

        {step === 2 && site ? (
          <div className="space-y-6">
            <div><h3 className="text-lg font-semibold text-white">Business location</h3><p className="mt-1 text-sm text-zinc-400">Location is optional for technical connection and can support later geographic planning.</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-zinc-300 md:col-span-2">Street Address<input value={primaryAddress.addressLine1} onChange={(event) => setPrimaryAddress((current) => ({ ...current, addressLine1: event.target.value }))} className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white" /></label>
              <label className="text-sm text-zinc-300">City<input value={primaryAddress.city} onChange={(event) => setPrimaryAddress((current) => ({ ...current, city: event.target.value }))} className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white" /></label>
              <label className="text-sm text-zinc-300">State / Region<input value={primaryAddress.stateRegion} onChange={(event) => setPrimaryAddress((current) => ({ ...current, stateRegion: event.target.value }))} className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white" /></label>
              <label className="text-sm text-zinc-300">Postal Code<input value={primaryAddress.postalCode} onChange={(event) => setPrimaryAddress((current) => ({ ...current, postalCode: event.target.value }))} className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white" /></label>
              <label className="text-sm text-zinc-300">Country<select value={primaryAddress.countryCode} onChange={(event) => setPrimaryAddress((current) => ({ ...current, countryCode: event.target.value }))} className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white"><option value="US">United States</option><option value="CA">Canada</option><option value="GB">United Kingdom</option><option value="AU">Australia</option></select></label>
            </div>
            <div className="flex flex-wrap justify-between gap-3"><button type="button" onClick={() => setStep(1)} className="border border-zinc-700 px-4 py-2 text-sm text-zinc-200">Back</button><button type="button" disabled={busy !== null} onClick={saveLocation} className="bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy === "location" ? "Saving..." : "Save Location & Continue"}</button></div>
          </div>
        ) : null}

        {step === 3 && site ? (
          <div className="space-y-6">
            <div><h3 className="text-lg font-semibold text-white">Connect WordPress</h3><p className="mt-1 text-sm text-zinc-400">Create an Application Password in WordPress and enter it here. Genesis stores only an encrypted credential; the secret is cleared from this form after storage.</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-zinc-300">WordPress Username<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white" /></label>
              <label className="text-sm text-zinc-300">Application Password<input type="password" autoComplete="new-password" value={applicationPassword} onChange={(event) => setApplicationPassword(event.target.value)} className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white" /></label>
            </div>
            {credentialsStored ? <p className="border-l-2 border-emerald-500 pl-3 text-sm text-emerald-200">Credentials stored. No secret value is returned or retained in the form.</p> : null}
            <div className="flex flex-wrap justify-between gap-3"><button type="button" onClick={() => setStep(2)} className="border border-zinc-700 px-4 py-2 text-sm text-zinc-200">Back</button><div className="flex gap-3"><button type="button" disabled={!username.trim() || !applicationPassword.trim() || busy !== null} onClick={storeCredentials} className="border border-zinc-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy === "credentials" ? "Storing..." : "Store Credentials"}</button><button type="button" disabled={!credentialsStored || busy !== null} onClick={() => assessConnection(4)} className="bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy === "assessment" ? "Testing..." : "Run Read-Only Connection Test"}</button></div></div>
          </div>
        ) : null}

        {step === 4 && site ? (
          <div className="space-y-6">
            <div><h3 className="text-lg font-semibold text-white">Configure Genesis authority</h3><p className="mt-1 text-sm text-zinc-400">Select only active profiles registered for {organizationId}. No settings are copied from another site automatically.</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              {PROFILE_FIELDS.map((item) => <ProfileSelect key={item.field} label={item.label} value={selectedProfiles[item.field]} profiles={profilesOfType(item.type)} onChange={(value) => setSelectedProfiles((current) => ({ ...current, [item.field]: value }))} />)}
              <ProfileSelect label="Generation workflow" value={selectedProfiles.workflowReference} profiles={profilesOfType("workflow")} onChange={(value) => setSelectedProfiles((current) => ({ ...current, workflowReference: value }))} />
              <label className="text-sm text-zinc-300">Publication Policy<select value={publicationPolicy} onChange={(event) => setPublicationPolicy(event.target.value as SitePublicationPolicy)} className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white"><option value="draft_only">Draft only</option><option value="publish_after_gates">Publish after all gates</option></select><span className="mt-1 block text-xs text-zinc-500">Draft only is the conservative onboarding default. Direct publish is not supported.</span></label>
            </div>
            {!configurationComplete ? <p className="border-l-2 border-amber-500 pl-3 text-sm text-amber-200">All five profile categories are required. Missing organization profiles must be registered through Genesis Profiles before campaign readiness.</p> : null}
            <div className="flex justify-end"><button type="button" disabled={!configurationComplete || busy !== null} onClick={saveConfiguration} className="bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy === "configuration" ? "Saving..." : "Save Configuration & Verify"}</button></div>
          </div>
        ) : null}

        {step === 5 && assessment && site ? (
          <div className="space-y-6">
            <div className="border-l-4 border-emerald-500 bg-emerald-950/20 p-5"><p className="text-xs font-semibold uppercase text-emerald-300">{assessment.completionState}</p><h3 className="mt-2 text-xl font-semibold text-white">{site.displayName} is connected</h3><p className="mt-2 text-sm text-zinc-300">The WordPress identity is verified and the site remains disabled for production generation. Product authority is the next boundary.</p></div>
            <div className="grid gap-4 lg:grid-cols-2"><section className="border border-zinc-800 p-4"><h4 className="font-semibold text-white">Integration Assessment</h4><p className="mt-3 text-2xl font-semibold text-emerald-300">{assessment.complexity}</p><p className="mt-1 text-sm text-zinc-400">Estimated effort: {assessment.effort}</p></section><section className="border border-zinc-800 p-4"><h4 className="font-semibold text-white">WordPress Inventory</h4><p className="mt-3 text-sm text-zinc-300">Pages {assessment.inventory.pages} · Posts {assessment.inventory.posts} · Media {assessment.inventory.media} · Products {assessment.inventory.productCount}</p></section></div>
            <section className="border border-zinc-800 p-4"><h4 className="font-semibold text-white">Canonical Site Readiness</h4><p className="mt-2 text-sm text-zinc-300">{assessment.readiness.ready ? "Ready" : "Blocked by design during onboarding"}</p>{assessment.readiness.blockingReasons.length ? <ul className="mt-3 space-y-1 text-xs text-amber-200">{assessment.readiness.blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}</section>
            <div className="grid gap-4 md:grid-cols-2">
              <Link href={`/products/new?organizationId=${encodeURIComponent(organizationId)}&siteId=${encodeURIComponent(site.siteId)}&source=url`} className="border border-zinc-700 p-4 text-left hover:border-red-500"><span className="font-semibold text-white">Add Product by URL</span><span className="mt-1 block text-sm text-zinc-400">Use a first-party product URL when one exists.</span></Link>
              <Link href={`/products/new?organizationId=${encodeURIComponent(organizationId)}&siteId=${encodeURIComponent(site.siteId)}&source=manual`} className="border border-zinc-700 p-4 text-left hover:border-red-500"><span className="font-semibold text-white">Manual / Source-Based Product</span><span className="mt-1 block text-sm text-zinc-400">Prepare authority from owner documents, specifications, images, and approved sources.</span></Link>
            </div>
            <div className="flex flex-wrap gap-3"><Link href={`/sites/${encodeURIComponent(site.siteId)}`} className="border border-zinc-700 px-4 py-2 text-sm font-semibold text-white">Go to Site</Link><span className="border border-zinc-800 px-4 py-2 text-sm text-zinc-500">Campaign Launchpad unlocks after a product is READY</span></div>
          </div>
        ) : null}

        {error ? <div role="alert" className="mt-6 border border-red-900 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}
      </div>
    </section>
  );
}

function ProfileSelect(input: { label: string; value: string; profiles: IntegrationProfileConfiguration[]; onChange(value: string): void }) {
  return (
    <label className="text-sm text-zinc-300">{input.label}<select value={input.value} onChange={(event) => input.onChange(event.target.value)} className="mt-1 h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-white"><option value="">Select a registered profile</option>{input.profiles.map((profile) => <option key={profile.profileId} value={profile.profileId}>{profile.profileName}</option>)}</select></label>
  );
}

function PreflightPanel({ result }: { result: PublicWordPressPreflightResult }) {
  return (
    <section className={`border p-4 ${result.ready ? "border-emerald-800 bg-emerald-950/20" : "border-red-900 bg-red-950/20"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold text-white">Public Technical Preflight</h4><span className={`text-xs font-semibold ${result.ready ? "text-emerald-300" : "text-red-300"}`}>{result.ready ? "READY" : "BLOCKED"}</span></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-300 sm:grid-cols-4">{Object.entries(result.checks).map(([key, passed]) => <div key={key}><span className={passed ? "text-emerald-300" : "text-red-300"}>{passed ? "PASS" : "FAIL"}</span><span className="ml-2 capitalize">{key.replace(/([A-Z])/g, " $1")}</span></div>)}</div>
      <p className="mt-3 text-sm text-zinc-300">Integration Complexity: <strong>{result.integration.complexity}</strong> · Estimated effort: {result.integration.effort}</p>
    </section>
  );
}