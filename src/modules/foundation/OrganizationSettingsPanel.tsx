"use client";

import { useEffect, useMemo, useState } from "react";
import type { Company } from "@/types/models/Company";

type ApiOrganizationListResponse = {
  organizations: Company[];
};

type ApiCreateResponse = {
  organization?: Company;
  error?: string;
  issues?: Array<{ field: string; message: string }>;
};

export function OrganizationSettingsPanel(input: { canManageSettings: boolean }) {
  const [organizations, setOrganizations] = useState<Company[]>([]);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedOrganizations = useMemo(
    () => [...organizations].sort((left, right) => left.name.localeCompare(right.name)),
    [organizations],
  );

  async function loadOrganizations() {
    const response = await fetch("/api/organizations", {
      method: "GET",
      headers: {
        "x-gcp-roles": "ops_manager",
      },
      cache: "no-store",
    });

    const payload = (await response.json()) as ApiOrganizationListResponse & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? `Failed to load organizations (${response.status}).`);
    }

    setOrganizations(payload.organizations);
  }

  useEffect(() => {
    loadOrganizations().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Unable to load organizations.");
    });
  }, []);

  async function createOrganization() {
    if (!input.canManageSettings) {
      setError("Organization creation requires owner settings permissions.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gcp-roles": "platform_admin",
        },
        body: JSON.stringify({
          id: organizationId,
          name: organizationName,
          status: "active",
          ownerAuthorization: "OWNER_AUTHORIZED_CREATE_ORGANIZATION",
        }),
      });
      const payload = (await response.json()) as ApiCreateResponse;
      if (!response.ok) {
        throw new Error(
          payload.error
          ?? payload.issues?.map((issue) => issue.message).join(" ")
          ?? `Organization creation failed (${response.status}).`,
        );
      }
      setMessage(`Organization ${payload.organization?.name ?? organizationName} created.`);
      setOrganizationName("");
      setOrganizationId("");
      await loadOrganizations();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Organization creation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Organizations</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Owner-controlled organization creation with persisted foundation records.
          </p>
        </div>
        <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
          {sortedOrganizations.length} total
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-zinc-300">
          Organization display name
          <input
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
            placeholder="PageEngines"
            disabled={!input.canManageSettings || busy}
          />
        </label>
        <label className="text-sm text-zinc-300">
          Stable organization ID
          <input
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
            placeholder="pageengines"
            disabled={!input.canManageSettings || busy}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={createOrganization}
          disabled={!input.canManageSettings || busy || !organizationName.trim() || !organizationId.trim()}
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create Organization"}
        </button>
        {!input.canManageSettings ? (
          <p className="text-xs text-amber-300">Owner settings permission required.</p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p>
      ) : null}

      <ul className="mt-5 space-y-2 text-sm">
        {sortedOrganizations.map((organization) => (
          <li key={organization.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-zinc-200">
            <span className="font-semibold text-white">{organization.name}</span>{" "}
            <span className="text-zinc-400">({organization.id})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
