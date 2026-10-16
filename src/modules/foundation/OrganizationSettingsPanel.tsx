"use client";

import { useEffect, useMemo, useState } from "react";
import { hasPermission, resolvePermissions } from "@/modules/foundation/permissions";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";
import type { AppRole } from "@/modules/foundation/types";
import type { Company } from "@/types/models/Company";

type ApiOrganizationListResponse = {
  organizations: Company[];
};

type ApiCreateResponse = {
  organization?: Company;
  error?: string;
  issues?: Array<{ field: string; message: string }>;
};

type OperatorSessionStatusResponse = {
  authenticated?: boolean;
  principal?: {
    roles?: unknown;
  } | null;
};

const KNOWN_ROLES: readonly AppRole[] = [
  "platform_admin",
  "ops_manager",
  "operations",
  "company_operator",
  "analyst",
  "manufacturing_planner",
  "manufacturing_engineer",
  "production_supervisor",
  "executive",
  "administrator",
  "viewer",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAppRole(value: string): value is AppRole {
  return KNOWN_ROLES.includes(value as AppRole);
}

export function canManageSettingsFromSessionStatus(payload: unknown): boolean {
  if (!isObject(payload) || payload.authenticated !== true) return false;
  const principal = payload.principal;
  if (!isObject(principal) || !Array.isArray(principal.roles)) return false;
  const roles = principal.roles.filter((role): role is AppRole => typeof role === "string" && isAppRole(role));
  if (roles.length === 0) return false;
  return hasPermission(resolvePermissions(roles), "settings:manage");
}

export function createOrganizationRequestHeaders(): HeadersInit {
  return operatorMutationHeaders({
    "content-type": "application/json",
    "x-gcp-roles": "platform_admin",
  });
}

export function OrganizationSettingsPanel(input: { canManageSettings: boolean }) {
  const [canManageSettings, setCanManageSettings] = useState(input.canManageSettings);
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

  useEffect(() => {
    let active = true;
    void fetch("/api/operator-session", { cache: "no-store" })
      .then(async (response) => {
        if (!active || !response.ok) return;
        const payload = (await response.json()) as OperatorSessionStatusResponse;
        setCanManageSettings(canManageSettingsFromSessionStatus(payload));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function createOrganization() {
    if (!canManageSettings) {
      setError("Organization creation requires owner settings permissions.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: createOrganizationRequestHeaders(),
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
            disabled={!canManageSettings || busy}
          />
        </label>
        <label className="text-sm text-zinc-300">
          Stable organization ID
          <input
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-white outline-none focus:border-red-500"
            placeholder="pageengines"
            disabled={!canManageSettings || busy}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={createOrganization}
          disabled={!canManageSettings || busy || !organizationName.trim() || !organizationId.trim()}
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create Organization"}
        </button>
        {!canManageSettings ? (
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
