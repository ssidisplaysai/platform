import Link from "next/link";
import {
  evaluateAllProfileReadiness,
  getProfileUsage,
  listIntegrationProfiles,
} from "./integration-profile-repository";
import type { IntegrationProfileType } from "./types";

function toLabel(profileType: IntegrationProfileType): string {
  switch (profileType) {
    case "publishing":
      return "Publishing";
    case "wordpress":
      return "WordPress";
    case "workflow":
      return "Workflow";
    case "prompt":
      return "Prompt";
    case "image":
      return "Image";
    case "seo":
      return "SEO";
    case "brand":
      return "Brand";
    case "analytics":
      return "Analytics";
  }
}

export function ProfilesRegistryView(input: {
  profileType?: IntegrationProfileType;
  query?: string;
  enabledOnly?: boolean;
}) {
  const profiles = listIntegrationProfiles({
    profileType: input.profileType,
    query: input.query,
    enabled: input.enabledOnly ? true : undefined,
  });

  const readinessById = new Map(
    evaluateAllProfileReadiness({
      profileType: input.profileType,
      query: input.query,
      enabled: input.enabledOnly ? true : undefined,
    }).map((readiness) => [readiness.profileId, readiness]),
  );

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Integration Profile Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
          {input.profileType ? `${toLabel(input.profileType)} Profiles` : "Integration Profiles"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Configuration-only profile registry with deterministic readiness, usage, and inheritance visibility.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-3" action="" method="GET">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Search
            <input
              type="text"
              name="query"
              defaultValue={input.query ?? ""}
              placeholder="name, reference, profile id"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Filter
            <select
              name="enabledOnly"
              defaultValue={input.enabledOnly ? "true" : "false"}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
            >
              <option value="false">All Profiles</option>
              <option value="true">Enabled Only</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="h-10 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-300 hover:border-red-500 hover:text-white"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </header>

      {profiles.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          No profiles matched the current search/filter criteria.
        </div>
      ) : (
        <ul className="space-y-3">
          {profiles.map((profile) => {
            const readiness = readinessById.get(profile.profileId);
            const usage = getProfileUsage(profile.profileId);
            const inheritedUsageCount = usage.filter((entry) => entry.inherited).length;

            return (
              <li
                key={profile.profileId}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">{toLabel(profile.profileType)} Profile</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">{profile.profileName}</h2>
                    <p className="text-xs text-zinc-500">{profile.profileId}</p>
                    <p className="mt-2 text-zinc-400">{profile.description ?? "No description"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 lg:grid-cols-3">
                    <span className="rounded border border-zinc-700 px-2 py-1">Status: {profile.status}</span>
                    <span className="rounded border border-zinc-700 px-2 py-1">Enabled: {profile.enabled ? "Yes" : "No"}</span>
                    <span className="rounded border border-zinc-700 px-2 py-1">Version: {profile.version}</span>
                    <span className="rounded border border-zinc-700 px-2 py-1">Usage: {usage.length}</span>
                    <span className="rounded border border-zinc-700 px-2 py-1">Inherited: {inheritedUsageCount}</span>
                    <span className="rounded border border-zinc-700 px-2 py-1">Ready: {readiness?.ready ? "Yes" : "No"}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Blocking Conditions</p>
                    {readiness && readiness.blockers.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-amber-300">
                        {readiness.blockers.slice(0, 4).map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-emerald-300">No blockers</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Inheritance And Usage</p>
                    {usage.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                        {usage.slice(0, 4).map((entry) => (
                          <li key={`${entry.targetType}:${entry.targetId}:${entry.inherited ? "inherited" : "direct"}`}>
                            {entry.targetType}:{entry.targetId} ({entry.inherited ? "inherited" : "direct"})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-400">No usage recorded.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <Link
                    href={`/profile/${profile.profileId}`}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                  >
                    Open Profile Detail
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
