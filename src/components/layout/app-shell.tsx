"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { createFoundationContext, getSitesForOrganization } from "@/modules/foundation/context";
import { FOUNDATION_COMMANDS, FOUNDATION_NAVIGATION_ITEMS } from "@/modules/foundation/navigation";
import { hasPermission, resolvePermissions } from "@/modules/foundation/permissions";
import { getVisibleCommandPaletteActions, getVisibleNavigationItems } from "@/modules/foundation/selectors";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const foundationContext = useMemo(() => createFoundationContext(), []);
  const permissions = useMemo(
    () => resolvePermissions(foundationContext.user.roles),
    [foundationContext.user.roles],
  );

  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    foundationContext.selectedOrganizationId,
  );

  const [selectedSiteId, setSelectedSiteId] = useState(foundationContext.selectedSiteId);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  const visibleNavigationItems = useMemo(
    () => getVisibleNavigationItems(FOUNDATION_NAVIGATION_ITEMS, permissions),
    [permissions],
  );

  const availableSites = useMemo(
    () => getSitesForOrganization(foundationContext.sites, selectedOrganizationId),
    [foundationContext.sites, selectedOrganizationId],
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

  function handleOrganizationChange(nextOrganizationId: string) {
    setSelectedOrganizationId(nextOrganizationId);
    const nextSite = foundationContext.sites.find(
      (site) => site.organizationId === nextOrganizationId,
    );

    if (nextSite) {
      setSelectedSiteId(nextSite.id);
    }
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
              onChange={(event) => setSelectedSiteId(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-red-500"
            >
              {availableSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.region})
                </option>
              ))}
            </select>
          </section>

          <nav className="mt-8 space-y-2">
            {visibleNavigationItems.map((item) => {
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