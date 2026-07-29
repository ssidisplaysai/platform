"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CompanyRepository } from "@/core/repositories/CompanyRepository";
import { filterSites, SITE_ENVIRONMENTS, SITE_HEALTH_STATES, SITE_LIFECYCLE_STATES } from "./site-selectors";
import { listSites } from "./site-repository";
import type {
  SiteConfiguration,
  SiteEnvironment,
  SiteHealthStatus,
  SiteLifecycleState,
  SiteListFilters,
} from "./types";
import { evaluateSiteReadiness } from "./site-readiness";
import { resolvePermissions } from "./permissions";

export function MultiSiteListView() {
  const initialState = useMemo(() => {
    try {
      return {
        loading: false,
        error: null as string | null,
        sites: listSites(),
      };
    } catch (error) {
      return {
        loading: false,
        error: error instanceof Error ? error.message : "Unable to load sites.",
        sites: [] as readonly SiteConfiguration[],
      };
    }
  }, []);

  const [loading] = useState(initialState.loading);
  const [error] = useState<string | null>(initialState.error);
  const [sites] = useState<readonly SiteConfiguration[]>(initialState.sites);
  const [filters, setFilters] = useState<SiteListFilters>({
    query: "",
  });

  const permissions = useMemo(() => resolvePermissions(["ops_manager"]), []);

  const filteredSites = useMemo(() => filterSites(sites, filters), [sites, filters]);

  const organizations = CompanyRepository.getAll();

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
        Loading multi-site foundation...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
        Error loading sites: {error}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <input
          type="search"
          value={filters.query ?? ""}
          onChange={(event) =>
            setFilters((current) => ({ ...current, query: event.target.value }))
          }
          placeholder="Search by site name or domain"
          className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-red-500 md:col-span-2"
        />

        <select
          value={filters.organizationId ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              organizationId: event.target.value || undefined,
            }))
          }
          className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-red-500"
        >
          <option value="">All Organizations</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>

        <select
          value={filters.environment ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              environment: (event.target.value || undefined) as SiteEnvironment | undefined,
            }))
          }
          className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-red-500"
        >
          <option value="">All Environments</option>
          {SITE_ENVIRONMENTS.map((environment) => (
            <option key={environment} value={environment}>
              {environment}
            </option>
          ))}
        </select>

        <select
          value={filters.lifecycleState ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              lifecycleState: (event.target.value || undefined) as SiteLifecycleState | undefined,
            }))
          }
          className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-red-500"
        >
          <option value="">All Lifecycle States</option>
          {SITE_LIFECYCLE_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>

        <select
          value={filters.healthStatus ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              healthStatus: (event.target.value || undefined) as SiteHealthStatus | undefined,
            }))
          }
          className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-red-500"
        >
          <option value="">All Health States</option>
          {SITE_HEALTH_STATES.map((healthState) => (
            <option key={healthState} value={healthState}>
              {healthState}
            </option>
          ))}
        </select>
      </div>

      {filteredSites.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-sm text-zinc-400">
          No sites matched the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-900/80 text-zinc-400">
              <tr>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Environment</th>
                <th className="px-4 py-3">Lifecycle</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Readiness</th>
                <th className="px-4 py-3">Last Publish</th>
                <th className="px-4 py-3">Last Test</th>
                <th className="px-4 py-3">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site) => {
                const readiness = evaluateSiteReadiness({
                  site,
                  organizationActive: true,
                  requiredPermission: "sites:manage_integrations",
                  permissions,
                  intent: "publish",
                  requireWorkflowReference: true,
                });

                return (
                  <tr key={site.siteId} className="border-t border-zinc-900">
                    <td className="px-4 py-3">
                      <Link className="text-red-400 hover:text-red-300" href={`/sites/${site.siteId}`}>
                        {site.siteName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{site.organizationId}</td>
                    <td className="px-4 py-3">{site.domain ?? "Not configured"}</td>
                    <td className="px-4 py-3">{site.environment}</td>
                    <td className="px-4 py-3">{site.lifecycleState}</td>
                    <td className="px-4 py-3">{site.healthStatus}</td>
                    <td className="px-4 py-3">{readiness.ready ? "Ready" : "Blocked"}</td>
                    <td className="px-4 py-3">{site.lastSuccessfulPublication ?? "Never"}</td>
                    <td className="px-4 py-3">{site.lastConnectionTest ?? "Never"}</td>
                    <td className="px-4 py-3">{site.enabled ? "Yes" : "No"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
