"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CompanyRepository } from "@/core/repositories/CompanyRepository";
import { validateNewSiteInput } from "./site-validation";
import type { SiteConfiguration,
  NewSiteInput, SiteEnvironment } from "./types";

type CreatedSite = {
  organizationId: string;
  siteId: string;
  siteName: string;
  displayName: string;
  onboarding?: {
    status: "not_started" | "connected" | "certified";
    wordpressConnectionVerifiedAt: string | null;
    certificationStatus: "not_started" | "certified";
    certificationPageId: string | null;
    certificationUrl: string | null;
    certifiedAt: string | null;
  };
};

type SiteOnboardingPreset = {
  siteName: string;
  displayName: string;
  slug: string;
  domain: string;
  environment: SiteEnvironment;
  wordpressCredentialReference: string | null;
};

const SITE_ONBOARDING_PRESETS: Record<string, SiteOnboardingPreset> = {
  "screen-solutions-international": {
    siteName: "Screen Solutions International",
    displayName: "SSI Displays",
    slug: "screen-solutions-international",
    domain: "ssidisplays.com",
    environment: "production",
    wordpressCredentialReference: "SSI_WORDPRESS_CREDENTIAL_REFERENCE",
  },
};

function getOnboardingPreset(
  organizationId: string,
): SiteOnboardingPreset | null {
  const organization = CompanyRepository.getAll().find(
    (candidate) => candidate.id === organizationId,
  );

  if (!organization) {
    return null;
  }

  if (organization.name === "Screen Solutions International") {
    return SITE_ONBOARDING_PRESETS["screen-solutions-international"];
  }

  return SITE_ONBOARDING_PRESETS[organizationId] ?? null;
}

function applyOnboardingPreset(
  current: NewSiteInput,
  organizationId: string,
): NewSiteInput {
  const preset = getOnboardingPreset(organizationId);

  if (!preset) {
    return {
      ...current,
      organizationId,
      siteName: "",
      displayName: "",
      slug: "",
      domain: null,
      canonicalUrl: null,
      integrations: {
        ...current.integrations,
        wordpressApiBaseUrl: null,
        wordpressCredentialReference: null,
      },
    };
  }

  return {
    ...current,
    organizationId,
    siteName: preset.siteName,
    displayName: preset.displayName,
    slug: preset.slug,
    domain: preset.domain,
    canonicalUrl: `https://${preset.domain}`,
    environment: preset.environment,
    integrations: {
      ...current.integrations,
      wordpressApiBaseUrl: `https://${preset.domain}/wp-json/wp/v2`,
      wordpressCredentialReference: preset.wordpressCredentialReference,
    },
  };
}
function createInitialFormState(): NewSiteInput {
  const organizationId = CompanyRepository.getAll()[0]?.id ?? "";

  const baseState: NewSiteInput = {
    organizationId,
    siteName: "",
    displayName: "",
    slug: "",
    domain: null,
    primaryAddress: {
      addressLine1: "",
      addressLine2: null,
      city: "",
      stateRegion: "",
      postalCode: "",
      countryCode: "US",
    },
    canonicalUrl: null,
    environment: "production",
    enabled: false,
    defaultContentType: "article",
    defaultPublicationStatus: "draft",
    defaultAuthorReference: null,
    defaultCategoryReferences: [],
    integrations: {
      wordpressApiBaseUrl: null,
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
    notes: null,
  };

  return applyOnboardingPreset(baseState, organizationId);
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SiteCreateFoundationForm() {
  const router = useRouter();
  const organizations = CompanyRepository.getAll();

  const [form, setForm] = useState<NewSiteInput>(() => createInitialFormState());
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [createdSite, setCreatedSite] = useState<CreatedSite | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [connectionSucceeded, setConnectionSucceeded] = useState(false);
  const [testPagePublishing, setTestPagePublishing] = useState(false);
  const [testPageResult, setTestPageResult] = useState<{
    state: "published" | "already_published";
    url: string;
  } | null>(null);
  const [testPageError, setTestPageError] = useState<string | null>(null);
  const [wordpressUsername, setWordpressUsername] = useState("");
  const [wordpressApplicationPassword, setWordpressApplicationPassword] = useState("");
  const [credentialSaving, setCredentialSaving] = useState(false);
  const [credentialConfigured, setCredentialConfigured] = useState(false);
  const [credentialManagedByGenesis, setCredentialManagedByGenesis] = useState(false);
  const [credentialEditing, setCredentialEditing] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteSaveMessage, setSiteSaveMessage] = useState<string | null>(null);

  const validation = useMemo(() => validateNewSiteInput(form), [form]);
  function updatePrimaryAddress(
    field:
      | "addressLine1"
      | "addressLine2"
      | "city"
      | "stateRegion"
      | "postalCode"
      | "countryCode",
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      primaryAddress: {
        addressLine1: current.primaryAddress?.addressLine1 ?? "",
        addressLine2: current.primaryAddress?.addressLine2 ?? null,
        city: current.primaryAddress?.city ?? "",
        stateRegion: current.primaryAddress?.stateRegion ?? "",
        postalCode: current.primaryAddress?.postalCode ?? "",
        countryCode: current.primaryAddress?.countryCode ?? "US",
        [field]: field === "addressLine2" ? value || null : value,
      },
    }));
  }

  useEffect(() => {
    let cancelled = false;

    async function discoverExistingSite() {
      if (!form.organizationId || !form.slug) {
        return;
      }

      try {
        const response = await fetch("/api/sites", {
          method: "GET",
          headers: {
            "x-gcp-roles": "ops_manager",
            "x-gcp-organization-id": form.organizationId,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          sites?: Array<SiteConfiguration>;
        };

        const existing = (payload.sites ?? []).find(
          (site) => site.slug === form.slug,
        );

        if (cancelled) {
          return;
        }

        if (existing) {
          setCreatedSite({
            organizationId: existing.organizationId,
            siteId: existing.siteId,
            siteName: existing.siteName,
            displayName: existing.displayName,
          });

          setForm((current) => ({
            ...current,
            siteName: existing.siteName,
            displayName: existing.displayName,
            slug: existing.slug,
            domain: existing.domain,
            canonicalUrl: existing.canonicalUrl,
            environment: existing.environment,
            primaryAddress: existing.primaryAddress,
            integrations: {
              ...current.integrations,
              ...existing.integrations,
            },
            profiles: {
              ...current.profiles,
              ...existing.profiles,
            },
          }));
          setMessage(`Existing site loaded: ${existing.displayName}`);
        void loadCredentialStatus(existing);

        if (
          existing.onboarding?.status === "certified" &&
          existing.onboarding.certificationUrl
        ) {
          setConnectionSucceeded(true);
          setConnectionMessage(
            "WordPress connection previously verified by Genesis.",
          );
          setTestPageResult({
            state: "already_published",
            url: existing.onboarding.certificationUrl,
          });
          setWizardStep(5);
        } else if (existing.onboarding?.status === "connected") {
          setConnectionSucceeded(true);
          setConnectionMessage(
            "WordPress connection previously verified by Genesis.",
          );
          setWizardStep(4);
        }
          return;
        }

        setCreatedSite(null);
      } catch {
        // Existing-site discovery is convenience behavior only.
        // The normal create flow remains available if discovery fails.
      }
    }

    void discoverExistingSite();


  return () => {
      cancelled = true;
    };
  }, [form.organizationId, form.slug]);

  function applyDomain(rawValue: string) {
    const domain = normalizeDomain(rawValue);

    setForm((current) => ({
      ...current,
      domain: domain || null,
      canonicalUrl: domain ? `https://${domain}` : null,
      integrations: {
        ...current.integrations,
        wordpressApiBaseUrl: domain
          ? `https://${domain}/wp-json/wp/v2`
          : null,
      },
    }));
  }

  function applySiteName(value: string) {
    setForm((current) => ({
      ...current,
      siteName: value,
      displayName: current.displayName || value,
      slug: current.slug || slugify(value),
    }));
  }

  async function loadCredentialStatus(site: CreatedSite) {
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(site.siteId)}/wordpress-credentials`,
        {
          method: "GET",
          headers: {
            "x-gcp-roles": "ops_manager",
            "x-gcp-organization-id": form.organizationId,
            "x-gcp-site-id": site.siteId,
          },
          cache: "no-store",
        },
      );

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        configured?: boolean;
        managedByGenesis?: boolean;
      };

      setCredentialConfigured(Boolean(payload.configured));
      setCredentialManagedByGenesis(Boolean(payload.managedByGenesis));
    } catch {
      // Credential status is a convenience signal only.
    }
  }

  async function saveWordPressCredentials() {
    if (
      !createdSite ||
      credentialSaving ||
      !wordpressUsername.trim() ||
      !wordpressApplicationPassword.trim()
    ) {
      return;
    }

    setCredentialSaving(true);
    setCredentialMessage(null);
    setConnectionSucceeded(false);
    setConnectionMessage(null);

    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(createdSite.siteId)}/wordpress-credentials`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-gcp-roles": "ops_manager",
            "x-gcp-organization-id": form.organizationId,
            "x-gcp-site-id": createdSite.siteId,
          },
          body: JSON.stringify({
            username: wordpressUsername,
            applicationPassword: wordpressApplicationPassword,
          }),
        },
      );

      const payload = (await response.json()) as {
        configured?: boolean;
        managedByGenesis?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.configured) {
        throw new Error(
          payload.error ?? "Genesis could not save the WordPress credentials.",
        );
      }

      setCredentialConfigured(true);
      setCredentialManagedByGenesis(Boolean(payload.managedByGenesis));
      setCredentialEditing(false);

      // Never retain the submitted secret in browser state after success.
      setWordpressUsername("");
      setWordpressApplicationPassword("");

      setCredentialMessage(
        "WordPress credentials securely stored by Genesis.",
      );
    } catch (error) {
      setCredentialMessage(
        error instanceof Error
          ? error.message
          : "Genesis could not save the WordPress credentials.",
      );
    } finally {
      setCredentialSaving(false);
    }
  }
  async function createSite() {
    if (!validation.valid || submitting) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setConnectionMessage(null);

    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gcp-roles": "ops_manager",
          "x-gcp-organization-id": form.organizationId,
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json();

      if (!response.ok) {
        const issueText = Array.isArray(payload?.issues)
          ? payload.issues
              .map((issue: { field?: string; message?: string }) =>
                `${issue.field ?? "site"}: ${issue.message ?? "Invalid value"}`,
              )
              .join("; ")
          : payload?.error ?? "Unable to create site.";

        throw new Error(issueText);
      }

      setCreatedSite(payload.site);
      setCredentialConfigured(false);
      setCredentialManagedByGenesis(false);
      setCredentialEditing(true);
      setCredentialMessage(null);
      setMessage(`Site created: ${payload.site.displayName}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create site.");
    } finally {
      setSubmitting(false);
    }
  }


  async function saveExistingSiteDetails() {
    if (!createdSite || siteSaving) {
      return false;
    }

    setSiteSaving(true);
    setSiteSaveMessage(null);

    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(createdSite.siteId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-gcp-roles": "ops_manager",
            "x-gcp-organization-id": form.organizationId,
            "x-gcp-site-id": createdSite.siteId,
          },
          body: JSON.stringify({
            siteName: form.siteName,
            displayName: form.displayName,
            domain: form.domain,
            canonicalUrl: form.canonicalUrl,
            environment: form.environment,
            primaryAddress: form.primaryAddress,
            integrations: {
              wordpressApiBaseUrl:
                form.integrations.wordpressApiBaseUrl,
            },
          }),
        },
      );

      const payload = (await response.json()) as {
        site?: {
          organizationId: string;
          siteId: string;
          siteName: string;
          displayName: string;
        };
        error?: string;
        issues?: Array<{
          field?: string;
          message?: string;
        }>;
      };

      if (!response.ok || !payload.site) {
        const issueText = Array.isArray(payload.issues)
          ? payload.issues
              .map(
                (issue) =>
                  `${issue.field ?? "site"}: ${
                    issue.message ?? "Invalid value"
                  }`,
              )
              .join("; ")
          : payload.error ?? "Unable to save site details.";

        throw new Error(issueText);
      }

      setCreatedSite({
        organizationId:
          payload.site.organizationId || form.organizationId,
        siteId: payload.site.siteId,
        siteName: payload.site.siteName,
        displayName: payload.site.displayName,
      });

      setSiteSaveMessage("Site details saved.");
      return true;
    } catch (error) {
      setSiteSaveMessage(
        error instanceof Error
          ? error.message
          : "Unable to save site details.",
      );
      return false;
    } finally {
      setSiteSaving(false);
    }
  }
  async function publishGenesisTestPage() {
    if (!createdSite || testPagePublishing || !connectionSucceeded) {
      return;
    }

    setTestPagePublishing(true);
    setTestPageError(null);

    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(createdSite.siteId)}/onboarding-test-page`,
        {
          method: "POST",
          headers: {
            "x-gcp-roles": "ops_manager",
            "x-gcp-organization-id": form.organizationId,
            "x-gcp-site-id": createdSite.siteId,
          },
        },
      );

      const payload = (await response.json()) as {
        result?: {
          ok: boolean;
          state?: "published" | "already_published";
          url?: string;
          message?: string;
        };
        error?: string;
      };

      if (
        !response.ok ||
        !payload.result?.ok ||
        !payload.result.state ||
        !payload.result.url
      ) {
        setTestPageError(
          payload.result?.message ??
            payload.error ??
            `Genesis test-page publication failed (${response.status}).`,
        );
        return;
      }

      setTestPageResult({
        state: payload.result.state,
        url: payload.result.url,
      });

      if (payload.onboarding) {
        setCreatedSite((current) =>
          current
            ? {
                ...current,
                onboarding: payload.onboarding,
              }
            : current,
        );
      }
    } catch {
      setTestPageError(
        "Genesis could not complete the onboarding publication request.",
      );
    } finally {
      setTestPagePublishing(false);
    }
  }
  async function testConnection() {
    if (!createdSite || testing) {
      return;
    }

    setTesting(true);
    setConnectionMessage(null);
    setConnectionSucceeded(false);

    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(createdSite.siteId)}/connection-test`,
        {
          method: "POST",
          headers: {
            "x-gcp-roles": "ops_manager",
            "x-gcp-organization-id": form.organizationId,
            "x-gcp-site-id": createdSite.siteId,
          },
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Connection test failed.");
      }

      const status = payload?.result?.status ?? "unknown";
      const details =
        payload?.result?.message ??
        payload?.result?.details ??
        "Connection test completed.";

      setConnectionSucceeded(status === "success");
      setConnectionMessage(`WordPress connection: ${status}. ${details}`);
    } catch (error) {
      setConnectionSucceeded(false);
      setConnectionMessage(
        error instanceof Error ? error.message : "Connection test failed.",
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">
              Genesis Site Studio
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-white">
              Site Setup
            </h2>

            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Connect a WordPress website to Genesis and certify that the
              complete publishing path is working.
            </p>
          </div>

          {createdSite ? (
            <div className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300">
              {createdSite.displayName}
            </div>
          ) : null}
        </div>

        <div className="mt-7 grid gap-2 sm:grid-cols-5">
          {[
            [1, "Site Details"],
            [2, "Location"],
            [3, "WordPress"],
            [4, "Connect"],
            [5, "Complete"],
          ].map(([step, label]) => {
            const stepNumber = step as number;
            const isActive = wizardStep === stepNumber;
            const isComplete =
              wizardStep > stepNumber ||
              (stepNumber === 3 && credentialConfigured) ||
              (stepNumber === 4 &&
                connectionSucceeded &&
                Boolean(testPageResult));

            return (
              <button
                key={stepNumber}
                type="button"
                onClick={() => {
                  if (
                    stepNumber === 1 ||
                    createdSite ||
                    stepNumber <= wizardStep
                  ) {
                    setWizardStep(stepNumber);
                  }
                }}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  isActive
                    ? "border-red-500 bg-red-950/30"
                    : isComplete
                      ? "border-emerald-900 bg-emerald-950/20"
                      : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div
                  className={`text-xs font-bold ${
                    isActive
                      ? "text-red-300"
                      : isComplete
                        ? "text-emerald-300"
                        : "text-zinc-500"
                  }`}
                >
                  {isComplete ? "✓" : `0${stepNumber}`}
                </div>

                <div className="mt-1 text-xs font-semibold text-zinc-200">
                  {label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {wizardStep === 1 ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
                Step 1
              </p>

              <h3 className="mt-2 text-xl font-semibold text-white">
                Site Details
              </h3>

              <p className="mt-1 text-sm text-zinc-400">
                Tell Genesis which website this is. Technical URLs and normal
                publishing defaults are derived automatically.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-zinc-300">
                Organization
                <select
                  value={form.organizationId}
                  disabled={Boolean(createdSite)}
                  onChange={(event) =>
                    setForm((current) =>
                      applyOnboardingPreset(
                        current,
                        event.target.value,
                      ),
                    )
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white disabled:opacity-50"
                >
                  {organizations.map((organization) => (
                    <option
                      key={organization.id}
                      value={organization.id}
                    >
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-zinc-300">
                Environment
                <select
                  value={form.environment}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      environment:
                        event.target.value as SiteEnvironment,
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </label>

              <label className="text-sm text-zinc-300">
                Site Name
                <input
                  value={form.siteName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      siteName: event.target.value,
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
                />
              </label>

              <label className="text-sm text-zinc-300">
                Display Name
                <input
                  value={form.displayName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
                />
              </label>

              <label className="text-sm text-zinc-300 md:col-span-2">
                Domain
                <input
                  value={form.domain ?? ""}
                  onChange={(event) =>
                    applyDomain(event.target.value)
                  }
                  placeholder="example.com"
                  className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
                />
              </label>
            </div>

            <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400 md:grid-cols-3">
              <div>
                <span className="block text-zinc-500">Site Slug</span>
                <span className="mt-1 block text-zinc-200">
                  {form.slug}
                </span>
              </div>

              <div>
                <span className="block text-zinc-500">
                  Canonical URL
                </span>
                <span className="mt-1 block break-all text-zinc-200">
                  {form.canonicalUrl ?? "Derived from domain"}
                </span>
              </div>

              <div>
                <span className="block text-zinc-500">
                  WordPress REST API
                </span>
                <span className="mt-1 block break-all text-zinc-200">
                  {form.integrations.wordpressApiBaseUrl ??
                    "Derived from domain"}
                </span>
              </div>
            </div>

            {!validation.valid && !createdSite ? (
              <div className="rounded-xl border border-amber-900 bg-amber-950/20 p-4 text-sm text-amber-200">
                {validation.issues
                  .map((issue) => issue.message)
                  .join(" ")}
              </div>
            ) : null}

            {message ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
                {message}
              </div>
            ) : null}

            {siteSaveMessage ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
                {siteSaveMessage}
              </div>
            ) : null}

            <div className="flex justify-end">
              {!createdSite ? (
                <button
                  type="button"
                  disabled={submitting || !validation.valid}
                  onClick={async () => {
                    await createSite();
                  }}
                  className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? "Creating Site..." : "Create Site"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={siteSaving}
                  onClick={async () => {
                    const saved =
                      await saveExistingSiteDetails();

                    if (saved) {
                      setWizardStep(2);
                    }
                  }}
                  className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {siteSaving ? "Saving..." : "Save & Continue"}
                </button>
              )}
            </div>

            {createdSite ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="text-sm font-semibold text-red-300 hover:text-red-200"
                >
                  Continue to Location →
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {wizardStep === 2 ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
                Step 2
              </p>

              <h3 className="mt-2 text-xl font-semibold text-white">
                Business Location
              </h3>

              <p className="mt-1 text-sm text-zinc-400">
                Add the site's primary business location. Genesis can use this
                later as the origin for geographic market planning.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-zinc-300 md:col-span-2">
                Street Address
                <input
                  value={form.primaryAddress?.addressLine1 ?? ""}
                  onChange={(event) =>
                    updatePrimaryAddress(
                      "addressLine1",
                      event.target.value,
                    )
                  }
                  placeholder="123 Main Street"
                  className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
                />
              </label>

              <label className="text-sm text-zinc-300 md:col-span-2">
                Address Line 2
                <input
                  value={form.primaryAddress?.addressLine2 ?? ""}
                  onChange={(event) =>
                    updatePrimaryAddress(
                      "addressLine2",
                      event.target.value,
                    )
                  }
                  placeholder="Suite, unit, building"
                  className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
                />
              </label>

              <label className="text-sm text-zinc-300">
                City
                <input
                  value={form.primaryAddress?.city ?? ""}
                  onChange={(event) =>
                    updatePrimaryAddress(
                      "city",
                      event.target.value,
                    )
                  }
                  placeholder="Rocklin"
                  className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
                />
              </label>

              <label className="text-sm text-zinc-300">
                State / Region
                <input
                  value={form.primaryAddress?.stateRegion ?? ""}
                  onChange={(event) =>
                    updatePrimaryAddress(
                      "stateRegion",
                      event.target.value,
                    )
                  }
                  placeholder="CA"
                  className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
                />
              </label>

              <label className="text-sm text-zinc-300">
                ZIP / Postal Code
                <input
                  value={form.primaryAddress?.postalCode ?? ""}
                  onChange={(event) =>
                    updatePrimaryAddress(
                      "postalCode",
                      event.target.value,
                    )
                  }
                  placeholder="95765"
                  className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
                />
              </label>

              <label className="text-sm text-zinc-300">
                Country
                <select
                  value={form.primaryAddress?.countryCode ?? "US"}
                  onChange={(event) =>
                    updatePrimaryAddress(
                      "countryCode",
                      event.target.value,
                    )
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white"
                >
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="MX">Mexico</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                </select>
              </label>
            </div>

            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">
                    Geographic Market Planner
                  </p>

                  <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                    Coming later: use this address as the starting point for a
                    map where you can select radius, cities, ZIP codes,
                    counties, custom market areas and exclusions.
                  </p>
                </div>

                <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-400">
                  Future
                </span>
              </div>
            </div>

            {siteSaveMessage ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
                {siteSaveMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:border-zinc-500"
              >
                ← Back
              </button>

              <button
                type="button"
                disabled={siteSaving}
                onClick={async () => {
                  const saved =
                    await saveExistingSiteDetails();

                  if (saved) {
                    setWizardStep(3);
                  }
                }}
                className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
              >
                {siteSaving
                  ? "Saving Location..."
                  : "Save Location & Continue"}
              </button>
            </div>
          </div>
        ) : null}

        {wizardStep === 3 ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
                Step 3
              </p>

              <h3 className="mt-2 text-xl font-semibold text-white">
                WordPress Access
              </h3>

              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                Genesis needs authenticated WordPress REST access to create
                and manage site content.
              </p>
            </div>

            {credentialConfigured && !credentialEditing ? (
              <div className="rounded-xl border border-emerald-900 bg-emerald-950/20 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-emerald-300">
                      ✓ Credentials configured
                    </p>

                    <p className="mt-1 text-sm text-zinc-400">
                      {credentialManagedByGenesis
                        ? "Credentials are encrypted and managed securely by Genesis."
                        : "This site is using an existing protected credential configuration."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCredentialEditing(true);
                      setCredentialMessage(null);
                    }}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:border-red-500"
                  >
                    Update Credentials
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm text-zinc-300">
                  WordPress Username
                  <input
                    type="text"
                    autoComplete="username"
                    value={wordpressUsername}
                    onChange={(event) =>
                      setWordpressUsername(event.target.value)
                    }
                    placeholder="WordPress username"
                    className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
                  />
                </label>

                <label className="text-sm text-zinc-300">
                  Application Password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={wordpressApplicationPassword}
                    onChange={(event) =>
                      setWordpressApplicationPassword(
                        event.target.value,
                      )
                    }
                    placeholder="WordPress Application Password"
                    className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
                  />

                  <span className="mt-1 block text-xs text-zinc-500">
                    Use a WordPress Application Password, not the normal
                    account password.
                  </span>
                </label>

                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <button
                    type="button"
                    disabled={
                      credentialSaving ||
                      !wordpressUsername.trim() ||
                      !wordpressApplicationPassword.trim()
                    }
                    onClick={saveWordPressCredentials}
                    className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {credentialSaving
                      ? "Saving Credentials..."
                      : "Save Credentials Securely"}
                  </button>

                  {credentialConfigured ? (
                    <button
                      type="button"
                      disabled={credentialSaving}
                      onClick={() => {
                        setCredentialEditing(false);
                        setWordpressUsername("");
                        setWordpressApplicationPassword("");
                        setCredentialMessage(null);
                      }}
                      className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:border-zinc-500"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {credentialMessage ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
                {credentialMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:border-zinc-500"
              >
                ← Back
              </button>

              <button
                type="button"
                disabled={!credentialConfigured}
                onClick={() => setWizardStep(4)}
                className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue to Connection Test →
              </button>
            </div>
          </div>
        ) : null}

        {wizardStep === 4 ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
                Step 4
              </p>

              <h3 className="mt-2 text-xl font-semibold text-white">
                Connect & Certify
              </h3>

              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                First verify authenticated WordPress access. Then Genesis will
                publish its fixed certification page to prove the complete
                publishing path.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div
                className={`rounded-xl border p-5 ${
                  connectionSucceeded
                    ? "border-emerald-900 bg-emerald-950/20"
                    : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                  Gate 1
                </div>

                <h4 className="mt-2 font-semibold text-white">
                  WordPress Connection
                </h4>

                <p className="mt-1 text-sm text-zinc-400">
                  Verify that Genesis can authenticate and read from this
                  WordPress site.
                </p>

                <button
                  type="button"
                  disabled={testing || !credentialConfigured}
                  onClick={testConnection}
                  className="mt-5 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {testing
                    ? "Testing Connection..."
                    : connectionSucceeded
                      ? "✓ Test Again"
                      : "Test WordPress Connection"}
                </button>
              </div>

              <div
                className={`rounded-xl border p-5 ${
                  testPageResult
                    ? "border-emerald-900 bg-emerald-950/20"
                    : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                  Gate 2
                </div>

                <h4 className="mt-2 font-semibold text-white">
                  Genesis Certification Page
                </h4>

                <p className="mt-1 text-sm text-zinc-400">
                  Publish the fixed Genesis Site Connection Test page. This is
                  the explicit onboarding publication exception.
                </p>

                <button
                  type="button"
                  disabled={
                    !connectionSucceeded ||
                    testPagePublishing ||
                    Boolean(testPageResult)
                  }
                  onClick={publishGenesisTestPage}
                  className="mt-5 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {testPagePublishing
                    ? "Publishing Certification..."
                    : testPageResult
                      ? "✓ Site Certified"
                      : "Publish Genesis Test Page"}
                </button>
              </div>
            </div>

            {connectionMessage ? (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  connectionSucceeded
                    ? "border-emerald-900 bg-emerald-950/20 text-emerald-200"
                    : "border-red-900 bg-red-950/30 text-red-200"
                }`}
              >
                {connectionMessage}
              </div>
            ) : null}

            {testPageResult ? (
              <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-5">
                <p className="font-semibold text-emerald-300">
                  ✓ Genesis certification complete
                </p>

                <p className="mt-1 text-sm text-emerald-100/80">
                  Genesis successfully published its certification page to this site.
                </p>

                <a
                  href={testPageResult.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-950"
                >
                  View Test Page ↗
                </a>
              </div>
            ) : null}

            {testPageError ? (
              <div className="rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-200">
                {testPageError}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setWizardStep(3)}
                className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:border-zinc-500"
              >
                ← Back
              </button>

              <button
                type="button"
                disabled={!connectionSucceeded || !testPageResult}
                onClick={() => setWizardStep(5)}
                className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Complete Setup →
              </button>
            </div>
          </div>
        ) : null}

        {wizardStep === 5 ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-800 bg-emerald-950/25 p-7 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-700 bg-emerald-950 text-2xl text-emerald-300">
                ✓
              </div>

              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Onboarding Complete
              </p>

              <h3 className="mt-2 text-2xl font-semibold text-white">
                Site Connected to Genesis
              </h3>

              <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
                {createdSite?.displayName ?? form.displayName} is configured,
                authenticated and certified for Genesis Site Studio.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Website
                </p>

                <p className="mt-2 font-semibold text-white">
                  {createdSite?.displayName ?? form.displayName}
                </p>

                <p className="mt-1 text-sm text-zinc-400">
                  {form.domain}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  WordPress
                </p>

                <p className="mt-2 font-semibold text-emerald-300">
                  ✓ Connected
                </p>

                <p className="mt-1 text-sm text-zinc-400">
                  Authenticated REST access verified
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Certification
                </p>

                <p className="mt-2 font-semibold text-emerald-300">
                  ✓ Published
                </p>

                {testPageResult ? (
                  <a
                    href={testPageResult.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm text-red-300 hover:text-red-200"
                  >
                    View Genesis Test Page ↗
                  </a>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400">
              <strong className="text-zinc-200">
                Publishing safety:
              </strong>{" "}
              Normal generated content remains draft-only. The fixed Genesis
              Site Connection Test is the one explicit onboarding publication
              used to certify this WordPress connection.
            </div>

            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setWizardStep(4)}
                className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:border-zinc-500"
              >
                ← Review Connection
              </button>

              <div className="flex flex-wrap gap-3">
                {createdSite ? (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/sites/${createdSite.siteId}`)
                    }
                    className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:border-red-500"
                  >
                    Open Site
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    if (!createdSite) {
                      return;
                    }

                    const organizationId =
                      createdSite.organizationId || form.organizationId;

                    if (!organizationId || !createdSite.siteId) {
                      setMessage(
                        "Unable to open Page Studio because the site identity is incomplete.",
                      );
                      return;
                    }

                    const params = new URLSearchParams({
                      organizationId,
                      siteId: createdSite.siteId,
                    });

                    router.push(`/glw/pages?${params.toString()}`);
                  }}
                  className="rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Start Generating Pages →
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
