import Link from "next/link";
import {
  evaluateProfileReadiness,
  getEffectiveProfileAssignments,
  getProfileUsage,
  getIntegrationProfileById,
} from "./integration-profile-repository";

export function ProfileDetailView(input: { profileId: string }) {
  const profile = getIntegrationProfileById(input.profileId);

  if (!profile) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
        Profile {input.profileId} was not found.
      </div>
    );
  }

  const readiness = evaluateProfileReadiness(profile.profileId);
  const usage = getProfileUsage(profile.profileId);
  const sampleInheritance = getEffectiveProfileAssignments({
    organizationId: profile.organizationId,
    targetType: "product",
    targetId: "prod-indoor-led-video-wall",
    siteId: "site-led-display-warehouse-production",
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Profile Detail</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{profile.profileName}</h1>
        <p className="mt-2 text-sm text-zinc-400">{profile.profileId}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 px-2 py-1">{profile.profileType}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">{profile.status}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">{profile.enabled ? "enabled" : "disabled"}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">v{profile.version}</span>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Readiness</h2>
          <p className="mt-2 text-sm text-zinc-300">Ready: {readiness?.ready ? "Yes" : "No"}</p>
          <p className="text-sm text-zinc-300">Warnings: {readiness?.warnings.length ?? 0}</p>
          <p className="text-sm text-zinc-300">Blockers: {readiness?.blockers.length ?? 0}</p>
          <ul className="mt-3 space-y-1 text-xs text-amber-300">
            {(readiness?.blockers ?? []).map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500">Timestamp: {readiness?.timestamp ?? "n/a"}</p>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Usage</h2>
          {usage.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No direct or inherited usage detected.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {usage.map((entry) => (
                <li key={`${entry.targetType}:${entry.targetId}:${entry.inherited ? "1" : "0"}`}>
                  {entry.targetType} - {entry.targetId} - {entry.inherited ? "inherited" : "direct"}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-semibold text-white">Inheritance Preview</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Deterministic effective assignments for product prod-indoor-led-video-wall under site-led-display-warehouse-production.
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
          {sampleInheritance.map((assignment) => (
            <li key={assignment.profileType} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <p className="font-semibold text-white">{assignment.profileType}</p>
              <p>Effective: {assignment.effectiveProfileId ?? "none"}</p>
              <p>Direct: {assignment.directProfileId ?? "none"}</p>
              <p>Inherited: {assignment.inheritedProfileId ?? "none"}</p>
              <p>Source: {assignment.inheritanceSource}</p>
            </li>
          ))}
        </ul>
      </article>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-semibold text-white">Reference Configuration</h2>
        <ul className="mt-3 space-y-1 text-xs text-zinc-300">
          {Object.entries(profile.references).map(([key, value]) => (
            <li key={key}>
              {key}: {value ?? "not configured"}
            </li>
          ))}
        </ul>
      </article>

      <div className="flex gap-3">
        <Link href="/profiles" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">
          Back To Profiles
        </Link>
      </div>
    </section>
  );
}
