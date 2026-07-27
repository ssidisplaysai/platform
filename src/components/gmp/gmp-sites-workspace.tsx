"use client";

import { useEffect, useMemo, useState } from "react";

type ProjectWithSites = {
  projectId: string;
  name: string;
  sites: Array<{
    siteId: string;
    displayName: string;
    primaryDomain: string;
    environment: string;
    publishingPlatform: string;
    connectionStatus: string;
  }>;
};

export function GmpSitesWorkspace() {
  const [projects, setProjects] = useState<ProjectWithSites[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const response = await fetch("/api/gmp/projects", {
        credentials: "include",
        cache: "no-store",
      }).catch(() => null);

      if (!response || !response.ok || cancelled) {
        return;
      }

      const payload = await response.json() as { projects: Array<{ projectId: string; name: string }> };
      const projectsWithSites = await Promise.all((payload.projects ?? []).map(async (project) => {
        const sitesResponse = await fetch(`/api/gmp/projects/${project.projectId}/sites`, {
          credentials: "include",
          cache: "no-store",
        }).catch(() => null);

        const sitesPayload = sitesResponse && sitesResponse.ok
          ? await sitesResponse.json() as { sites: ProjectWithSites["sites"] }
          : { sites: [] as ProjectWithSites["sites"] };

        return {
          projectId: project.projectId,
          name: project.name,
          sites: sitesPayload.sites,
        };
      }));

      if (!cancelled) {
        setProjects(projectsWithSites);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const siteCount = useMemo(() => projects.reduce((sum, project) => sum + project.sites.length, 0), [projects]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Sites</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Multi-Site Inventory</h1>
        <p className="mt-2 text-sm text-zinc-400">{siteCount} sites linked across {projects.length} projects.</p>
      </section>

      <section className="space-y-4">
        {projects.length === 0 ? <p className="text-sm text-zinc-400">No projects found yet.</p> : projects.map((project) => (
          <article key={project.projectId} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white">{project.name}</h2>
            <div className="mt-3 space-y-2">
              {project.sites.length === 0 ? <p className="text-sm text-zinc-400">No sites configured for this project.</p> : project.sites.map((site) => (
                <div key={site.siteId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <p className="text-sm font-medium text-white">{site.displayName}</p>
                  <p className="text-xs text-zinc-400">{site.primaryDomain} • {site.environment} • {site.publishingPlatform} • {site.connectionStatus}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
