"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createFoundationContext, getSitesForOrganization } from "@/modules/foundation/context";
import { FOUNDATION_COMMANDS, FOUNDATION_NAVIGATION_ITEMS } from "@/modules/foundation/navigation";
import { hasPermission, resolvePermissions } from "@/modules/foundation/permissions";
import { getVisibleCommandPaletteActions, getVisibleNavigationItems } from "@/modules/foundation/selectors";
import type { SiteConfiguration, SiteContext } from "@/modules/foundation/types";
const ORGANIZATION_STORAGE_KEY = "gcp.selectedOrganizationId";
const SITE_STORAGE_KEY = "gcp.selectedSiteId";

const COLLAPSIBLE_NAVIGATION_LABELS = new Set([
  "Companies",
  "Categories",
  "Manufacturers",
  "Inventory",
  "Customers",
  "Quotes",
  "Sales Orders",
  "Work Orders",
  "Production Jobs",
  "Operations",
]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const foundationContext = useMemo(() => createFoundationContext(), []);
  const permissions = useMemo(
    () => resolvePermissions(foundationContext.user.roles),
    [foundationContext.user.roles],
  );

  const initialSelection = useMemo(
    () => ({
      organizationId: foundationContext.selectedOrganizationId,
      siteId: foundationContext.selectedSiteId,
      message: null as string | null,
    }),
    [
      foundationContext.selectedOrganizationId,
      foundationContext.selectedSiteId,
    ],
  );
const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    initialSelection.organizationId,
  );

  const [selectedSiteId, setSelectedSiteId] = useState(initialSelection.siteId);
  const [liveSites, setLiveSites] = useState<readonly SiteContext[]>(
    foundationContext.sites,
  );
  const [siteSelectionMessage, setSiteSelectionMessage] = useState<string | null>(
    initialSelection.message,
  );
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [moreNavOpen, setMoreNavOpen] = useState(false);

  const visibleNavigationItems = useMemo(
    () => getVisibleNavigationItems(FOUNDATION_NAVIGATION_ITEMS, permissions),
    [permissions],
  );

  const availableSites = useMemo(
    () => getSitesForOrganization(liveSites, selectedOrganizationId),
    [liveSites, selectedOrganizationId],
  );

  const visibleCommands = useMemo(
    () =>
      getVisibleCommandPaletteActions(
        FOUNDATION_COMMANDS,
        permissions,
        commandQuery,
      ),
    [permissions, commandQuery],
  );

  const canUseCommandPalette = hasPermission(permissions, "command_palette:use");

  const selectedSite = useMemo(
    () => liveSites.find((site) => site.id === selectedSiteId) ?? null,
    [liveSites, selectedSiteId],
  );

  // SITE_STUDIO_HANDOFF_ORGANIZATION_SYNC
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedOrganizationId = params.get("organizationId");

    if (!requestedOrganizationId) {
      return;
    }

    const organizationExists = foundationContext.organizations.some(
      (organization) => organization.id === requestedOrganizationId,
    );

    if (!organizationExists) {
      return;
    }

    setSelectedOrganizationId(requestedOrganizationId);
    localStorage.setItem(
      ORGANIZATION_STORAGE_KEY,
      requestedOrganizationId,
    );
  }, [foundationContext.organizations]);

  // SITE_STUDIO_HANDOFF_SITE_SYNC
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedOrganizationId = params.get("organizationId");
    const requestedSiteId = params.get("siteId");

    if (
      !requestedOrganizationId ||
      !requestedSiteId ||
      selectedOrganizationId !== requestedOrganizationId
    ) {
      return;
    }

    const requestedSite = liveSites.find(
      (site) =>
        site.id === requestedSiteId &&
        site.organizationId === requestedOrganizationId,
    );

    if (!requestedSite) {
      return;
    }

    setSelectedSiteId(requestedSiteId);
    setSiteSelectionMessage(null);
    localStorage.setItem(
      SITE_STORAGE_KEY,
      requestedSiteId,
    );
  }, [liveSites, selectedOrganizationId]);
useEffect(() => {
    function restorePersistedWorkspaceSelection() {
      const params = new URLSearchParams(window.location.search);
      const requestedOrganizationId = params.get("organizationId");

      if (
        requestedOrganizationId &&
        foundationContext.organizations.some(
          (organization) => organization.id === requestedOrganizationId,
        )
      ) {
        return;
      }

      const persistedOrganizationId = localStorage.getItem(
        ORGANIZATION_STORAGE_KEY,
      );

      if (
        persistedOrganizationId &&
        foundationContext.organizations.some(
          (organization) => organization.id === persistedOrganizationId,
        )
      ) {
        setSelectedOrganizationId(persistedOrganizationId);
      }
    }

    restorePersistedWorkspaceSelection();
  }, [foundationContext.organizations]);
  useEffect(() => {
    if (selectedOrganizationId) {
      localStorage.setItem(ORGANIZATION_STORAGE_KEY, selectedOrganizationId);
    }
  }, [selectedOrganizationId]);

  useEffect(() => {
    if (selectedSiteId) {
      localStorage.setItem(SITE_STORAGE_KEY, selectedSiteId);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSitesForSelectedOrganization() {
      if (!selectedOrganizationId) {
        setLiveSites([]);
        setSelectedSiteId("");
        return;
      }

      try {
        const response = await fetch("/api/sites", {
          method: "GET",
          headers: {
            "x-gcp-roles": "ops_manager",
            "x-gcp-organization-id": selectedOrganizationId,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            setSiteSelectionMessage(
              `Unable to load sites for this organization (${response.status}).`,
            );
          }
          return;
        }

        const payload = (await response.json()) as {
          sites?: readonly SiteConfiguration[];
        };

        const sites: readonly SiteContext[] = (payload.sites ?? []).map(
          (site) => ({
            id: site.siteId,
            slug: site.slug,
            organizationId: site.organizationId,
            name: site.displayName,
            region: "US-CENTRAL",
            environment: site.environment,
            health: site.healthStatus,
            publishing: site.publishingStatus,
            enabled: site.enabled,
          }),
        );

        if (cancelled) {
          return;
        }

        setLiveSites(sites);

        const currentSite = sites.find(
          (site) => site.id === selectedSiteId,
        );

        if (currentSite) {
          setSiteSelectionMessage(null);
          return;
        }

        const firstSite = sites[0] ?? null;

        if (firstSite) {
          setSelectedSiteId(firstSite.id);
          localStorage.setItem(SITE_STORAGE_KEY, firstSite.id);
          setSiteSelectionMessage(null);
          return;
        }

        setSelectedSiteId("");
        localStorage.removeItem(SITE_STORAGE_KEY);
        setSiteSelectionMessage(
          "No sites are currently available for the selected organization.",
        );
      } catch {
        if (!cancelled) {
          setSiteSelectionMessage(
            "Unable to load sites for this organization.",
          );
        }
      }
    }

    void loadSitesForSelectedOrganization();

    return () => {
      cancelled = true;
    };
  }, [selectedOrganizationId]);

  function handleOrganizationChange(nextOrganizationId: string) {
    setSelectedOrganizationId(nextOrganizationId);
    const nextSite = liveSites.find(
      (site) => site.organizationId === nextOrganizationId,
    );

    if (nextSite) {
      setSelectedSiteId(nextSite.id);
      setSiteSelectionMessage(null);
      return;
    }

    setSelectedSiteId("");
    setSiteSelectionMessage(
      "No configured sites are currently available for the selected organization.",
    );
  }

  function handleSiteChange(nextSiteId: string) {
    setSelectedSiteId(nextSiteId);
    setSiteSelectionMessage(null);
    localStorage.setItem(SITE_STORAGE_KEY, nextSiteId);

    const params = new URLSearchParams(window.location.search);

    if (selectedOrganizationId) {
      params.set("organizationId", selectedOrganizationId);
    }

    params.set("siteId", nextSiteId);
    window.location.href = `${window.location.pathname}?${params.toString()}`;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="flex min-h-screen flex-col xl:flex-row">
        <aside className="w-full border-b border-zinc-800 bg-zinc-900 p-6 xl:w-80 xl:border-b-0 xl:border-r">
          <h1 className="text-2xl font-black tracking-wide text-red-500">STONER</h1>
          <p className="mt-1 text-sm text-zinc-400">Genesis Commerce Platform</p>

          <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Workspace Context</p>
            <p className="mt-2 text-sm font-semibold text-white">{foundationContext.user.name}</p>
            <p className="text-xs text-zinc-400">{foundationContext.user.email}</p>
            <p className="mt-3 text-xs text-zinc-500">
              Roles: {foundationContext.user.roles.join(", ")}
            </p>

            <label className="mt-4 block text-xs uppercase tracking-widest text-zinc-500">
              Organization
            </label>
            <select
              value={selectedOrganizationId}
              onChange={(event) => handleOrganizationChange(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-red-500"
            >
              {foundationContext.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-xs uppercase tracking-widest text-zinc-500">
              Site
            </label>
            <select
              value={selectedSiteId}
              onChange={(event) => handleSiteChange(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-red-500"
            >
              <option value="">Select a site context</option>
              {availableSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.region})
                </option>
              ))}
            </select>

            {selectedSite ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-zinc-700 px-2 py-1 text-zinc-300">
                  {selectedSite.environment}
                </span>
                <span className="rounded-full border border-zinc-700 px-2 py-1 text-zinc-300">
                  health: {selectedSite.health}
                </span>
                <span className="rounded-full border border-zinc-700 px-2 py-1 text-zinc-300">
                  publishing: {selectedSite.publishing}
                </span>
                {!selectedSite.enabled ? (
                  <span className="rounded-full border border-amber-600/50 bg-amber-600/10 px-2 py-1 text-amber-300">
                    disabled
                  </span>
                ) : null}
              </div>
            ) : null}

            {siteSelectionMessage ? (
              <p className="mt-3 text-xs text-amber-300">{siteSelectionMessage}</p>
            ) : null}
          </section>

          <nav className="mt-8 space-y-2">
            {visibleNavigationItems
              .filter((item) => !COLLAPSIBLE_NAVIGATION_LABELS.has(item.label))
              .map((item) => {
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`block w-full rounded-lg px-4 py-3 text-left text-sm transition ${
                      active
                        ? "bg-red-600 text-white"
                        : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setMoreNavOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-800 px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <span>More</span>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                    In Development
                  </span>
                </span>

                <span className="text-xs text-zinc-500">
                  {moreNavOpen ? "-" : "+"}
                </span>
              </button>

              {moreNavOpen ? (
                <div className="mt-2 space-y-1 border-l border-zinc-800 pl-3">
                  {visibleNavigationItems
                    .filter((item) =>
                      COLLAPSIBLE_NAVIGATION_LABELS.has(item.label),
                    )
                    .map((item) => {
                      const active = pathname === item.href;

                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`block w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                            active
                              ? "bg-red-600 text-white"
                              : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                </div>
              ) : null}
            </div>
          </nav>
        </aside>

        <section className="relative flex-1 p-6 md:p-10 xl:p-12">
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Application Foundation
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                Organization-aware shell with permission-filtered navigation.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/search"
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-red-500 hover:text-white"
              >
                Enterprise Search
              </Link>

              <button
                type="button"
                disabled={!canUseCommandPalette}
                onClick={() => setCommandPaletteOpen((open) => !open)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition enabled:hover:border-red-500 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Command Palette
              </button>
            </div>
          </div>

          {commandPaletteOpen ? (
            <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Command Query
              </label>
              <input
                type="search"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Search foundation commands"
                className="mt-2 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-red-500"
              />

              <ul className="mt-4 space-y-2">
                {visibleCommands.map((command) => (
                  <li key={command.id}>
                    <Link
                      href={command.href}
                      className="block rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 transition hover:border-red-500"
                    >
                      <p className="text-sm font-semibold text-white">{command.label}</p>
                      <p className="text-xs text-zinc-400">{command.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>

              {visibleCommands.length === 0 ? (
                <p className="mt-4 text-xs text-zinc-500">No commands available for this query.</p>
              ) : null}
            </div>
          ) : null}

          {children}
        </section>
      </div>
    </main>
  );
}
