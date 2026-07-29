"use client";

import { useMemo, useState } from "react";
import { CompanyRepository } from "@/core/repositories/CompanyRepository";
import { validateNewSiteInput } from "./site-validation";
import type { NewSiteInput, SiteEnvironment } from "./types";

function createInitialFormState(): NewSiteInput {
  return {
    organizationId: CompanyRepository.getAll()[0]?.id ?? "",
    siteName: "",
    displayName: "",
    slug: "",
    domain: null,
    canonicalUrl: null,
    environment: "test",
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
}

export function SiteCreateFoundationForm() {
  const organizations = CompanyRepository.getAll();
  const [form, setForm] = useState<NewSiteInput>(() => createInitialFormState());

  const validation = useMemo(() => validateNewSiteInput(form), [form]);

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <h2 className="text-xl font-semibold text-white">New Site Foundation Contract</h2>
      <p className="text-sm text-zinc-400">
        This bounded form validates non-secret site configuration fields. Publishing stays disabled by default.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-zinc-300">
          Organization
          <select
            value={form.organizationId}
            onChange={(event) =>
              setForm((current) => ({ ...current, organizationId: event.target.value }))
            }
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white"
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
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
                environment: event.target.value as SiteEnvironment,
              }))
            }
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white"
          >
            <option value="local">local</option>
            <option value="development">development</option>
            <option value="test">test</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
        </label>

        <label className="text-sm text-zinc-300">
          Site name
          <input
            value={form.siteName}
            onChange={(event) =>
              setForm((current) => ({ ...current, siteName: event.target.value }))
            }
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white"
          />
        </label>

        <label className="text-sm text-zinc-300">
          Display name
          <input
            value={form.displayName}
            onChange={(event) =>
              setForm((current) => ({ ...current, displayName: event.target.value }))
            }
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white"
          />
        </label>

        <label className="text-sm text-zinc-300">
          Slug
          <input
            value={form.slug}
            onChange={(event) =>
              setForm((current) => ({ ...current, slug: event.target.value }))
            }
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white"
          />
        </label>

        <label className="text-sm text-zinc-300">
          Domain
          <input
            value={form.domain ?? ""}
            onChange={(event) =>
              setForm((current) => ({ ...current, domain: event.target.value || null }))
            }
            className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white"
          />
        </label>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-sm text-zinc-300">Validation: {validation.valid ? "valid" : "invalid"}</p>
        {!validation.valid ? (
          <ul className="mt-2 space-y-1 text-xs text-amber-300">
            {validation.issues.map((issue) => (
              <li key={`${issue.field}-${issue.message}`}>
                {issue.field}: {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            Valid input still creates a Draft disabled site with publishing disabled by default.
          </p>
        )}
      </div>
    </section>
  );
}
