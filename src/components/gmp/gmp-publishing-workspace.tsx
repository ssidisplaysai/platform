"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type PublishingMode = "project" | "destinations" | "packages" | "releases" | "publications" | "page";

type DestinationSummary = {
  destinationId: string;
  destinationType: string;
  name: string;
  baseUrl: string;
  connectionStatus: string;
  environment: string;
};

type PackageSummary = {
  publishingPackageId: string;
  contentDraftId: string;
  destinationId: string;
  packageStatus: string;
  releaseStatus: string;
  packageVersion: number;
  targetSlug: string;
  createdAt: string;
};

type ReleaseSummary = {
  releaseId: string;
  releaseName: string;
  releaseType: string;
  releaseStatus: string;
  scheduledAt?: string | null;
  createdAt: string;
};

type PublicationSummary = {
  publicationRecordId: string;
  externalUrl: string;
  publishedStatus: string;
  verificationStatus: string;
  createdAt: string;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function GmpPublishingWorkspace({ projectId, pageId, mode }: { projectId: string; pageId?: string; mode: PublishingMode }) {
  const [destinations, setDestinations] = useState<DestinationSummary[]>([]);
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [publications, setPublications] = useState<PublicationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const destinationResponse = await fetch(`/api/gmp/projects/${projectId}/publishing/destinations`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (destinationResponse?.ok) {
      const destinationPayload = await destinationResponse.json() as { destinations: DestinationSummary[] };
      setDestinations(destinationPayload.destinations ?? []);
    }

    const releaseResponse = await fetch(`/api/gmp/projects/${projectId}/publishing/releases`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (releaseResponse?.ok) {
      const releasePayload = await releaseResponse.json() as { releases: ReleaseSummary[] };
      setReleases(releasePayload.releases ?? []);
    }

    if (pageId) {
      const packageResponse = await fetch(`/api/gmp/pages/${pageId}/publishing/packages`, { credentials: "include", cache: "no-store" }).catch(() => null);
      if (packageResponse?.ok) {
        const packagePayload = await packageResponse.json() as { packages: PackageSummary[] };
        setPackages(packagePayload.packages ?? []);
      }

      const publicationResponse = await fetch(`/api/gmp/pages/${pageId}/publications`, { credentials: "include", cache: "no-store" }).catch(() => null);
      if (publicationResponse?.ok) {
        const publicationPayload = await publicationResponse.json() as { publications: PublicationSummary[] };
        setPublications(publicationPayload.publications ?? []);
      }
    } else {
      const publicationResponse = await fetch(`/api/gmp/projects/${projectId}/publishing/publications`, { credentials: "include", cache: "no-store" }).catch(() => null);
      if (publicationResponse?.ok) {
        const publicationPayload = await publicationResponse.json() as { publications: PublicationSummary[] };
        setPublications(publicationPayload.publications ?? []);
      }
    }
  }, [projectId, pageId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function onCreateDestination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      siteId: String(form.get("siteId") ?? ""),
      destinationType: String(form.get("destinationType") ?? "WORDPRESS"),
      name: String(form.get("name") ?? ""),
      baseUrl: String(form.get("baseUrl") ?? ""),
      environment: String(form.get("environment") ?? "production"),
      connectionStatus: "HEALTHY",
      credentialReference: String(form.get("credentialReference") ?? "").trim() || undefined,
    };

    const response = await fetch(`/api/gmp/projects/${projectId}/publishing/destinations`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Unable to create destination.");
      return;
    }

    setMessage("Destination created.");
    event.currentTarget.reset();
    await load();
  }

  async function onCreatePackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pageId) return;
    setError(null);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      contentDraftId: String(form.get("contentDraftId") ?? ""),
      destinationId: String(form.get("destinationId") ?? ""),
      publicationMode: String(form.get("publicationMode") ?? "PUBLISH_NOW"),
    };

    const response = await fetch(`/api/gmp/pages/${pageId}/publishing/packages`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Unable to build package. Confirm approved draft and destination eligibility.");
      return;
    }

    setMessage("Publishing package built.");
    event.currentTarget.reset();
    await load();
  }

  async function onCreateRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      siteId: String(form.get("siteId") ?? ""),
      releaseName: String(form.get("releaseName") ?? ""),
      releaseType: String(form.get("releaseType") ?? "SINGLE_PACKAGE"),
      scheduledAt: String(form.get("scheduledAt") ?? "").trim() || undefined,
    };

    const response = await fetch(`/api/gmp/projects/${projectId}/publishing/releases`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!response?.ok) {
      setError("Unable to create release.");
      return;
    }

    setMessage("Release created.");
    event.currentTarget.reset();
    await load();
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Publishing Governance</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Publishing Workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">Mode: {mode}. Build approved-revision packages, validate and approve them, then execute governed releases with durable publication records.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/glw/projects/${projectId}/publishing`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Overview</Link>
          <Link href={`/glw/projects/${projectId}/publishing/destinations`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Destinations</Link>
          <Link href={`/glw/projects/${projectId}/publishing/releases`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Releases</Link>
          {pageId ? <Link href={`/glw/projects/${projectId}/pages/${pageId}/publishing`} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-950">Page Publishing</Link> : null}
        </div>
      </section>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Destinations</h2>
          <div className="mt-3 space-y-2">
            {destinations.length === 0 ? <p className="text-sm text-zinc-400">No publishing destinations configured yet.</p> : destinations.map((destination) => (
              <div key={destination.destinationId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                <Link href={`/glw/projects/${projectId}/publishing/destinations/${destination.destinationId}`} className="text-sm font-medium text-white underline">{destination.name} • {destination.destinationType}</Link>
                <p className="text-xs text-zinc-400">{destination.baseUrl} • {destination.environment} • {destination.connectionStatus}</p>
              </div>
            ))}
          </div>

          <form className="mt-4 grid gap-2" onSubmit={(event) => void onCreateDestination(event)}>
            <input name="siteId" required placeholder="Site ID" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <input name="name" required placeholder="Destination name" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <input name="baseUrl" required placeholder="https://destination.example" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <div className="grid gap-2 sm:grid-cols-3">
              <select name="destinationType" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="WORDPRESS">WORDPRESS</option>
                <option value="HEADLESS_CMS">HEADLESS_CMS</option>
                <option value="STATIC_EXPORT">STATIC_EXPORT</option>
                <option value="CUSTOM_ADAPTER">CUSTOM_ADAPTER</option>
              </select>
              <select name="environment" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="production">production</option>
                <option value="staging">staging</option>
                <option value="development">development</option>
              </select>
              <input name="credentialReference" placeholder="Credential reference" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            </div>
            <button type="submit" className="justify-self-start rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Create Destination</button>
          </form>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Releases</h2>
          <div className="mt-3 space-y-2">
            {releases.length === 0 ? <p className="text-sm text-zinc-400">No releases created yet.</p> : releases.map((release) => (
              <div key={release.releaseId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                <Link href={`/glw/projects/${projectId}/publishing/releases/${release.releaseId}`} className="text-sm font-medium text-white underline">{release.releaseName} • {release.releaseType}</Link>
                <p className="text-xs text-zinc-400">{release.releaseStatus}{release.scheduledAt ? ` • ${formatDate(release.scheduledAt)}` : ""}</p>
              </div>
            ))}
          </div>

          <form className="mt-4 grid gap-2" onSubmit={(event) => void onCreateRelease(event)}>
            <input name="siteId" required placeholder="Site ID" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <input name="releaseName" required placeholder="Release name" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            <div className="grid gap-2 sm:grid-cols-2">
              <select name="releaseType" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="SINGLE_PACKAGE">SINGLE_PACKAGE</option>
                <option value="BATCH">BATCH</option>
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="UPDATE">UPDATE</option>
                <option value="REPUBLISH">REPUBLISH</option>
                <option value="ROLLBACK">ROLLBACK</option>
              </select>
              <input name="scheduledAt" placeholder="ISO schedule (optional)" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
            </div>
            <button type="submit" className="justify-self-start rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Create Release</button>
          </form>
        </article>
      </section>

      {pageId ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Page Publishing Packages</h2>
            <div className="mt-3 space-y-2">
              {packages.length === 0 ? <p className="text-sm text-zinc-400">No packages on this page yet.</p> : packages.map((pkg) => (
                <div key={pkg.publishingPackageId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <Link href={`/glw/projects/${projectId}/publishing/packages/${pkg.publishingPackageId}`} className="text-sm font-medium text-white underline">{pkg.publishingPackageId}</Link>
                  <p className="text-xs text-zinc-400">{pkg.packageStatus} • {pkg.releaseStatus} • {pkg.targetSlug}</p>
                </div>
              ))}
            </div>

            <form className="mt-4 grid gap-2" onSubmit={(event) => void onCreatePackage(event)}>
              <input name="contentDraftId" required placeholder="Approved content draft ID" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <select name="destinationId" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="">Select destination</option>
                {destinations.map((destination) => (
                  <option key={destination.destinationId} value={destination.destinationId}>{destination.name} ({destination.destinationType})</option>
                ))}
              </select>
              <select name="publicationMode" className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="PUBLISH_NOW">PUBLISH_NOW</option>
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="SAVE_DRAFT">SAVE_DRAFT</option>
              </select>
              <button type="submit" className="justify-self-start rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Build Publishing Package</button>
            </form>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Publication History</h2>
            <div className="mt-3 space-y-2">
              {publications.length === 0 ? <p className="text-sm text-zinc-400">No publication records yet.</p> : publications.map((publication) => (
                <div key={publication.publicationRecordId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <Link href={`/glw/projects/${projectId}/publishing/publications/${publication.publicationRecordId}`} className="text-sm font-medium text-white underline">{publication.publicationRecordId}</Link>
                  <p className="text-xs text-zinc-400">{publication.publishedStatus} • {publication.verificationStatus} • {formatDate(publication.createdAt)}</p>
                  <a href={publication.externalUrl} className="text-xs text-zinc-300 underline" target="_blank" rel="noreferrer">{publication.externalUrl}</a>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {!pageId ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Project Publication History</h2>
          <div className="mt-3 space-y-2">
            {publications.length === 0 ? <p className="text-sm text-zinc-400">No publication records yet.</p> : publications.map((publication) => (
              <div key={publication.publicationRecordId} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                <Link href={`/glw/projects/${projectId}/publishing/publications/${publication.publicationRecordId}`} className="text-sm font-medium text-white underline">{publication.publicationRecordId}</Link>
                <p className="text-xs text-zinc-400">{publication.publishedStatus} • {publication.verificationStatus} • {formatDate(publication.createdAt)}</p>
                <a href={publication.externalUrl} className="text-xs text-zinc-300 underline" target="_blank" rel="noreferrer">{publication.externalUrl}</a>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
