"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ProjectRecord = {
  projectId: string;
  name: string;
  slug: string;
  description?: string;
  organization?: string;
  status: string;
  lifecycleState: string;
  updatedAt: string;
};

type ProjectsPayload = {
  projects: ProjectRecord[];
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function GmpProjectsWorkspace() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function fetchProjects(): Promise<ProjectsPayload | null> {
    const response = await fetch("/api/gmp/projects", {
      credentials: "include",
      cache: "no-store",
    }).catch(() => null);

    if (!response || !response.ok) {
      return null;
    }

    return response.json() as Promise<ProjectsPayload>;
  }

  const load = async () => {
    const payload = await fetchProjects();
    if (!payload) {
      setError("Unable to load projects.");
      setLoading(false);
      return;
    }

    setProjects(payload.projects ?? []);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    void fetchProjects().then((payload) => {
      if (!active) {
        return;
      }

      if (!payload) {
        setError("Unable to load projects.");
        setLoading(false);
        return;
      }

      setProjects(payload.projects ?? []);
      setError(null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const activeCount = useMemo(() => projects.filter((project) => project.status === "ACTIVE").length, [projects]);

  async function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setSubmitting(true);
    const response = await fetch("/api/gmp/projects", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        slug: form.get("slug"),
        description: form.get("description"),
        organization: form.get("organization"),
        defaultLanguage: form.get("defaultLanguage"),
        defaultLocale: form.get("defaultLocale"),
        timezone: form.get("timezone"),
      }),
    }).catch(() => null);
    setSubmitting(false);

    if (!response || !response.ok) {
      const payload = await response?.json().catch(() => null);
      setError(payload?.error ?? "Unable to create project.");
      return;
    }

    event.currentTarget.reset();
    await load();
  }

  async function onArchive(projectId: string) {
    const response = await fetch(`/api/gmp/projects/${projectId}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => null);

    if (!response || !response.ok) {
      setError("Unable to archive project.");
      return;
    }

    await load();
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Marketing Platform</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Projects & Site Management</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Projects are the top-level business object for GMP. Create a project, connect sites, and manage brand and publishing context.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Projects</p>
          <p className="mt-2 text-2xl font-semibold text-white">{projects.length}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Active</p>
          <p className="mt-2 text-2xl font-semibold text-white">{activeCount}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Archived</p>
          <p className="mt-2 text-2xl font-semibold text-white">{projects.filter((project) => project.status === "ARCHIVED").length}</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Create Project</h2>
          <form className="mt-4 space-y-3" onSubmit={(event) => void onCreateProject(event)}>
            <input name="name" required placeholder="Project name" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <input name="slug" placeholder="project-slug" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <input name="organization" placeholder="Organization" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <textarea name="description" rows={3} placeholder="Description" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <div className="grid gap-2 sm:grid-cols-3">
              <input name="defaultLanguage" placeholder="en" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="defaultLocale" placeholder="en-US" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input name="timezone" placeholder="UTC" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            </div>
            <button disabled={submitting} type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60">
              {submitting ? "Creating..." : "Create project"}
            </button>
          </form>
          {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Projects</h2>
          {loading ? <p className="mt-3 text-sm text-zinc-400">Loading projects...</p> : null}
          {!loading && projects.length === 0 ? <p className="mt-3 text-sm text-zinc-400">No projects yet.</p> : null}
          {!loading && projects.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-zinc-200">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Lifecycle</th>
                    <th className="pb-2 pr-4">Updated</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.projectId} className="border-t border-zinc-800">
                      <td className="py-2 pr-4">
                        <p className="font-medium text-white">{project.name}</p>
                        <p className="text-xs text-zinc-500">{project.slug}</p>
                      </td>
                      <td className="py-2 pr-4">{project.status}</td>
                      <td className="py-2 pr-4">{project.lifecycleState}</td>
                      <td className="py-2 pr-4 text-zinc-400">{formatTimestamp(project.updatedAt)}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <Link href={`/glw/projects/${project.projectId}`} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-white">
                            Open
                          </Link>
                          <button
                            type="button"
                            onClick={() => void onArchive(project.projectId)}
                            className="rounded-lg border border-rose-700 px-2 py-1 text-xs text-rose-300"
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
