"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createFoundationContext, getSitesForOrganization } from "@/modules/foundation/context";
import { FOUNDATION_COMMANDS, FOUNDATION_NAVIGATION_ITEMS } from "@/modules/foundation/navigation";
import { hasPermission, resolvePermissions } from "@/modules/foundation/permissions";
import { getVisibleCommandPaletteActions, getVisibleNavigationItems } from "@/modules/foundation/selectors";
import type { AppRole, NavigationItem, SiteConfiguration, SiteContext } from "@/modules/foundation/types";
import { OperatorSessionStatus } from "./OperatorSessionStatus";
const ORGANIZATION_STORAGE_KEY = "gcp.selectedOrganizationId";
const SITE_STORAGE_KEY = "gcp.selectedSiteId";

const OPERATOR_GROUPS = ["CAMPAIGNS", "SITES", "RESEARCH & CONTENT", "OPERATIONS", "SYSTEM"] as const;
type NavigationCounts = { campaigns: number; targets: number; generatedPagesRequiringReview: number };

export function AppShell({ children, resourceSite = null }: { children: React.ReactNode; resourceSite?: SiteContext | null }) {
  const pathname = usePathname();
  const foundationContext = useMemo(() => createFoundationContext(), []);
  const [operatorRoles, setOperatorRoles] = useState<readonly AppRole[]>([]);
  const [sessionAvailability, setSessionAvailability] = useState<"CHECKING" | "AUTHENTICATED" | "AUTHENTICATION_REQUIRED">("CHECKING");
  const permissions = useMemo(
    () => resolvePermissions(operatorRoles),
    [operatorRoles],
  );

  const initialSelection = useMemo(
    () => ({
      organizationId: resourceSite?.organizationId ?? foundationContext.selectedOrganizationId,
      siteId: resourceSite?.id ?? foundationContext.selectedSiteId,
      message: null as string | null,
    }),
    [
      foundationContext.selectedOrganizationId,
      foundationContext.selectedSiteId,
      resourceSite,
    ],
  );
const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    initialSelection.organizationId,
  );

  const [selectedSiteId, setSelectedSiteId] = useState(
    initialSelection.siteId,
  );

  const [liveSites, setLiveSites] = useState<readonly SiteContext[]>(resourceSite && !foundationContext.sites.some((site) => site.id === resourceSite.id) ? [...foundationContext.sites, resourceSite] : foundationContext.sites);
  const [siteSelectionMessage, setSiteSelectionMessage] = useState<string | null>(
    initialSelection.message,
  );
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [moreNavOpen, setMoreNavOpen] = useState(false);
  const [navigationCounts, setNavigationCounts] = useState<NavigationCounts | null>(null);
  const effectiveOrganizationId = resourceSite?.organizationId ?? selectedOrganizationId;
  const effectiveSiteId = resourceSite?.id ?? selectedSiteId;

  useEffect(() => {
    let active = true;

    const sync = async () => {
      try {
        const response = await fetch("/api/operator-session", { cache: "no-store" });
        const body = await response.json() as { principal?: { roles?: AppRole[] } | null };
        if (!active) return;
        setOperatorRoles(response.ok && body.principal?.roles ? body.principal.roles : []);
        setSessionAvailability(response.ok ? "AUTHENTICATED" : "AUTHENTICATION_REQUIRED");
      } catch {
        if (active) {
          setOperatorRoles([]);
          setSessionAvailability("AUTHENTICATION_REQUIRED");
        }
      }
    };

    void sync();
    const intervalId = window.setInterval(() => {
      void sync();
    }, 5 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const visibleNavigationItems = useMemo(
    () => getVisibleNavigationItems(FOUNDATION_NAVIGATION_ITEMS, permissions),
    [permissions],
  );

  const availableSites = useMemo(
    () => {
      const sites = getSitesForOrganization(liveSites, effectiveOrganizationId);
      return resourceSite && resourceSite.organizationId === effectiveOrganizationId && !sites.some((site) => site.id === resourceSite.id) ? [...sites, resourceSite] : sites;
    },
    [liveSites, effectiveOrganizationId, resourceSite],
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
    () => resourceSite ?? liveSites.find((site) => site.id === effectiveSiteId) ?? null,
    [liveSites, effectiveSiteId, resourceSite],
  );

  // GLW_INITIAL_ROUTE_CONTEXT_SYNC
  useEffect(() => {
    if (pathname !== "/glw/campaigns") {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (params.get("organizationId") || params.get("siteId")) {
      return;
    }

    const persistedOrganizationId =
      localStorage.getItem(ORGANIZATION_STORAGE_KEY);
    const persistedSiteId =
      localStorage.getItem(SITE_STORAGE_KEY);

    const persistedSite =
      persistedOrganizationId && persistedSiteId
        ? liveSites.find(
            (site) =>
              site.id === persistedSiteId &&
              site.organizationId === persistedOrganizationId,
          )
        : null;

    const organizationId =
      persistedSite?.organizationId ?? selectedOrganizationId;
    const siteId =
      persistedSite?.id ?? selectedSiteId;

    if (!organizationId || !siteId) {
      return;
    }

    const validSite = liveSites.some(
      (site) =>
        site.id === siteId &&
        site.organizationId === organizationId,
    );

    if (!validSite) {
      return;
    }

    params.set("organizationId", organizationId);
    params.set("siteId", siteId);

    window.location.replace(
      `${window.location.pathname}?${params.toString()}`,
    );
  }, [
    pathname,
    liveSites,
    selectedOrganizationId,
    selectedSiteId,
  ]);

  // SITE_STUDIO_HANDOFF_ORGANIZATION_SYNC
  useEffect(() => {
    if (resourceSite) {
      return;
    }
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

    queueMicrotask(() => setSelectedOrganizationId(requestedOrganizationId));
    localStorage.setItem(
      ORGANIZATION_STORAGE_KEY,
      requestedOrganizationId,
    );
  }, [foundationContext.organizations, resourceSite]);

  // SITE_STUDIO_HANDOFF_SITE_SYNC
  useEffect(() => {
    if (resourceSite) {
      return;
    }
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

    queueMicrotask(() => {
      setSelectedSiteId(requestedSiteId);
      setSiteSelectionMessage(null);
    });
    localStorage.setItem(
      SITE_STORAGE_KEY,
      requestedSiteId,
    );
  }, [liveSites, selectedOrganizationId, resourceSite]);
useEffect(() => {
    function restorePersistedWorkspaceSelection() {
      if (resourceSite) {
        return;
      }
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
  }, [foundationContext.organizations, resourceSite]);
  useEffect(() => {
    if (effectiveOrganizationId) {
      localStorage.setItem(ORGANIZATION_STORAGE_KEY, effectiveOrganizationId);
    }
  }, [effectiveOrganizationId]);

  useEffect(() => {
    if (effectiveSiteId) {
      localStorage.setItem(SITE_STORAGE_KEY, effectiveSiteId);
    }
  }, [effectiveSiteId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSitesForSelectedOrganization() {
      if (sessionAvailability !== "AUTHENTICATED") {
        return;
      }
      if (resourceSite) {
        return;
      }
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
  }, [selectedOrganizationId, selectedSiteId, resourceSite, sessionAvailability]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (effectiveOrganizationId) params.set("organizationId", effectiveOrganizationId);
    if (effectiveSiteId) params.set("siteId", effectiveSiteId);
    void fetch(`/api/glw/operator-navigation-summary?${params.toString()}`, {
      headers: { "x-gcp-roles": "ops_manager" },
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) return null;
      return response.json() as Promise<{ global: NavigationCounts }>;
    }).then((payload) => {
      if (!cancelled && payload) setNavigationCounts(payload.global);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [effectiveOrganizationId, effectiveSiteId]);

  function navigationHref(item: NavigationItem): string {
    if (item.id === "campaigns") {
      const params = new URLSearchParams({ scope: "all" });
      if (effectiveOrganizationId) params.set("organizationId", effectiveOrganizationId);
      if (effectiveSiteId) params.set("siteId", effectiveSiteId);
      return `/glw/campaigns?${params.toString()}`;
    }
    if (item.id === "wordpress" && effectiveSiteId && effectiveOrganizationId) {
      return `/sites/${encodeURIComponent(effectiveSiteId)}/health?organizationId=${encodeURIComponent(effectiveOrganizationId)}&siteId=${encodeURIComponent(effectiveSiteId)}`;
    }
    if (item.id === "research" && effectiveSiteId && effectiveOrganizationId) {
      return `/sites/${encodeURIComponent(effectiveSiteId)}/intelligence?organizationId=${encodeURIComponent(effectiveOrganizationId)}&siteId=${encodeURIComponent(effectiveSiteId)}`;
    }
    return item.href;
  }

  function navigationBadge(item: NavigationItem): number | null {
    if (!navigationCounts) return null;
    if (item.id === "campaigns") return navigationCounts.campaigns;
    if (item.id === "targets") return navigationCounts.targets;
    if (item.id === "generated-pages") return navigationCounts.generatedPagesRequiringReview;
    return null;
  }

  function navigationLink(item: NavigationItem, prominent = false) {
    const href = navigationHref(item);
    const active = href && (pathname === href.split("?")[0] || (href !== "/" && pathname.startsWith(`${href.split("?")[0]}/`)));
    const badge = navigationBadge(item);
    const classes = `group flex min-h-10 w-full items-center gap-3 border-l-2 px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
      active
        ? "border-red-500 bg-red-500/10 font-semibold text-white"
        : prominent
          ? "border-transparent bg-zinc-800/70 font-semibold text-white hover:border-red-500"
          : "border-transparent text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/70 hover:text-white"
    }`;
    if (item.disabled) {
      return <span key={item.id} aria-disabled="true" title="Coming soon" className={`${classes} cursor-not-allowed opacity-45`}><span className="flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-700 text-[9px] font-bold text-zinc-500">{item.icon}</span><span className="min-w-0 flex-1 truncate">{item.label}</span><span className="text-[9px] uppercase text-zinc-600">Soon</span></span>;
    }
    return <Link key={item.id} href={href} aria-current={active ? "page" : undefined} title={item.description ?? item.label} className={classes}><span className="flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-700 text-[9px] font-bold text-zinc-400 group-hover:border-zinc-500">{item.icon}</span><span className="min-w-0 flex-1 truncate">{item.label}</span>{badge !== null ? <span className="min-w-6 border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums text-zinc-300">{badge}</span> : null}</Link>;
  }

  async function handleOrganizationChange(
    nextOrganizationId: string,
  ) {
    setSiteSelectionMessage(null);

    if (!resourceSite) {
      setSelectedOrganizationId(nextOrganizationId);
      localStorage.setItem(
        ORGANIZATION_STORAGE_KEY,
        nextOrganizationId,
      );
    }

    try {
      const response = await fetch("/api/sites", {
        method: "GET",
        headers: {
          "x-gcp-roles": "ops_manager",
          "x-gcp-organization-id": nextOrganizationId,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        if (resourceSite) {
          setSiteSelectionMessage(`Unable to load sites for this organization (${response.status}).`);
          return;
        }
        setSelectedSiteId("");
        localStorage.removeItem(SITE_STORAGE_KEY);
        setSiteSelectionMessage(
          `Unable to load sites for this organization (${response.status}).`,
        );
        return;
      }

      const payload = (await response.json()) as {
        sites?: readonly SiteConfiguration[];
      };

      const nextSite = payload.sites?.[0] ?? null;

      if (!nextSite) {
        if (resourceSite) {
          setSiteSelectionMessage("No configured sites are currently available for the selected organization.");
          return;
        }
        setSelectedSiteId("");
        localStorage.removeItem(SITE_STORAGE_KEY);
        setSiteSelectionMessage(
          "No configured sites are currently available for the selected organization.",
        );
        return;
      }

      if (resourceSite) {
        window.location.href = `/sites/${encodeURIComponent(nextSite.siteId)}`;
        return;
      }

      setSelectedSiteId(nextSite.siteId);
      localStorage.setItem(SITE_STORAGE_KEY, nextSite.siteId);

      const params = new URLSearchParams(window.location.search);
      params.set("organizationId", nextOrganizationId);
      params.set("siteId", nextSite.siteId);

      window.location.href =
        `${window.location.pathname}?${params.toString()}`;
    } catch {
      if (resourceSite) {
        setSiteSelectionMessage("Unable to load sites for this organization.");
        return;
      }
      setSelectedSiteId("");
      localStorage.removeItem(SITE_STORAGE_KEY);
      setSiteSelectionMessage(
        "Unable to load sites for this organization.",
      );
    }
  }

  function handleSiteChange(nextSiteId: string) {
    if (resourceSite) {
      window.location.href = `/sites/${encodeURIComponent(nextSiteId)}`;
      return;
    }

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
        <aside className="flex w-full flex-col border-b border-zinc-800 bg-zinc-900 p-4 xl:sticky xl:top-0 xl:h-screen xl:w-72 xl:border-b-0 xl:border-r xl:p-5">
          <h1 className="text-2xl font-black tracking-wide text-red-500">STONER</h1>
          <p className="mt-1 text-sm text-zinc-400">Genesis Commerce Platform</p>

          <section className="mt-6 border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Workspace Context</p>
            <p className="mt-2 text-sm font-semibold text-white"><OperatorSessionStatus /></p>

            <label className="mt-4 block text-xs uppercase tracking-widest text-zinc-500">
              Organization
            </label>
            <select
              disabled={sessionAvailability !== "AUTHENTICATED"}
              value={effectiveOrganizationId}
              onChange={(event) => handleOrganizationChange(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500"
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
              disabled={sessionAvailability !== "AUTHENTICATED"}
              value={effectiveSiteId}
              onChange={(event) => handleSiteChange(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <option value="">Select a site context</option>
              {availableSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.region})
                </option>
              ))}
            </select>

            {sessionAvailability === "AUTHENTICATED" && selectedSite ? (
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

            {sessionAvailability === "AUTHENTICATION_REQUIRED" ? (
              <p className="mt-3 text-xs font-semibold text-amber-300">AUTHENTICATION_REQUIRED: workspace and campaign data are unavailable until sign-in is restored.</p>
            ) : siteSelectionMessage ? (
              <p className="mt-3 text-xs text-amber-300">{siteSelectionMessage}</p>
            ) : null}
          </section>

          <nav aria-label="Primary operator navigation" className="mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
            <div className="space-y-1 border-b border-zinc-800 pb-4">
              {visibleNavigationItems.filter((item) => item.group === "DASHBOARD").map((item) => navigationLink(item, true))}
            </div>
            {OPERATOR_GROUPS.map((group) => {
              const items = visibleNavigationItems.filter((item) => item.group === group);
              if (!items.length) return null;
              return <section key={group} aria-labelledby={`nav-${group.replaceAll(" ", "-").toLowerCase()}`} className="mt-4"><p id={`nav-${group.replaceAll(" ", "-").toLowerCase()}`} className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">{group}</p><div className="space-y-0.5">{items.map((item) => navigationLink(item))}</div></section>;
            })}

            <div className="mt-4 border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setMoreNavOpen((open) => !open)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <span>More tools</span>

                <span className="text-xs text-zinc-500">
                  {moreNavOpen ? "-" : "+"}
                </span>
              </button>

              {moreNavOpen ? (
                <div className="mt-1 space-y-0.5 border-l border-zinc-800 pl-2">
                  {visibleNavigationItems
                    .filter((item) => item.group === "MORE")
                    .map((item) => navigationLink(item))}
                </div>
              ) : null}
            </div>
            <div className="mt-auto border-t border-zinc-800 pt-4">
              {visibleNavigationItems.filter((item) => item.group === "UTILITY").map((item) => navigationLink(item))}
            </div>
          </nav>
        </aside>

        <section className="relative min-w-0 flex-1 p-6 md:p-10 xl:p-12">
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
                className="mt-2 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500"
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

          {sessionAvailability === "AUTHENTICATED" ? children : (
            <section className="border border-amber-700/60 bg-amber-950/20 p-6" aria-live="polite">
              <h2 className="text-lg font-semibold text-amber-200">Operator session expired / sign in required</h2>
              <p className="mt-2 text-sm text-zinc-300">Campaign data unavailable until authentication is restored. No zero or empty values shown here represent durable campaign state.</p>
              <Link href="/operator-login" className="mt-4 inline-flex border border-amber-600 px-3 py-2 text-sm font-semibold text-amber-100">Sign in</Link>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
