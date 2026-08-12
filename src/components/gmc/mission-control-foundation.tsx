"use client";

import { useMemo, useState } from "react";
import type { MissionControlApplication, MissionControlFilters, MissionControlWorkspace } from "@/platform/gmc";

type Props = {
  workspace: MissionControlWorkspace;
  filters: MissionControlFilters;
};

function launchBlockReasonLabel(reason?: MissionControlApplication["launch"]["launchBlockReason"]): string {
  switch (reason) {
    case "BLOCKED_INACTIVE":
      return "Blocked: application is not active";
    case "BLOCKED_UNAVAILABLE":
      return "Blocked: application is unavailable";
    case "BLOCKED_INCOMPATIBLE":
      return "Blocked: compatibility requirements not met";
    case "BLOCKED_MISSING_METADATA":
      return "Blocked: launch metadata is missing";
    case "BLOCKED_INVALID_TARGET":
      return "Blocked: launch target failed safety checks";
    default:
      return "Blocked by launch policy";
  }
}

function matches(application: MissionControlApplication, input: {
  q: string;
  company: string;
  category: string;
  health: string;
  availability: string;
  compatibility: string;
  capability: string;
  status: string;
}): boolean {
  if (input.q.trim()) {
    const query = input.q.toLowerCase();
    const haystack = [
      application.displayName,
      application.description,
      application.company,
      application.category,
      ...application.capabilities,
    ].join(" ").toLowerCase();

    if (!haystack.includes(query)) {
      return false;
    }
  }

  if (input.company && application.company !== input.company) {
    return false;
  }

  if (input.category && application.category !== input.category) {
    return false;
  }

  if (input.health && application.health.state !== input.health) {
    return false;
  }

  if (input.availability && application.health.availability !== input.availability) {
    return false;
  }

  if (input.compatibility) {
    const expected = input.compatibility === "compatible";
    if (application.compatibility.compatible !== expected) {
      return false;
    }
  }

  if (input.capability && !application.capabilities.includes(input.capability)) {
    return false;
  }

  if (input.status && application.registrationStatus !== input.status) {
    return false;
  }

  return true;
}

function Pill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs">
      <span className="text-zinc-400">{label}</span>
      <p className="mt-1 font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

export function MissionControlFoundation({ workspace, filters }: Props) {
  const [q, setQ] = useState("");
  const [company, setCompany] = useState("");
  const [category, setCategory] = useState("");
  const [health, setHealth] = useState("");
  const [availability, setAvailability] = useState("");
  const [compatibility, setCompatibility] = useState("");
  const [capability, setCapability] = useState("");
  const [status, setStatus] = useState("");

  const applications = useMemo(() => workspace.applicationCatalog.filter((application) => matches(application, {
    q,
    company,
    category,
    health,
    availability,
    compatibility,
    capability,
    status,
  })), [workspace.applicationCatalog, q, company, category, health, availability, compatibility, capability, status]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-100">{workspace.home.title}</h2>
        <p className="mt-2 text-sm text-zinc-400">{workspace.home.subtitle}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Pill label="Applications" value={workspace.dashboard.totals.applications} />
          <Pill label="Enterprise Health" value={workspace.healthOverview.enterpriseState} />
          <Pill label="Readiness" value={workspace.healthOverview.enterpriseReadiness} />
          <Pill label="Availability" value={workspace.healthOverview.enterpriseAvailability} />
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search applications" className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
        <select value={company} onChange={(event) => setCompany(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
          <option value="">All companies</option>
          {filters.companies.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
          <option value="">All categories</option>
          {filters.categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select value={health} onChange={(event) => setHealth(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
          <option value="">All health states</option>
          {filters.healthStates.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select value={availability} onChange={(event) => setAvailability(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
          <option value="">All availability</option>
          {filters.availabilityStates.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select value={compatibility} onChange={(event) => setCompatibility(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
          <option value="">All compatibility</option>
          {filters.compatibilityStates.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select value={capability} onChange={(event) => setCapability(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
          <option value="">All capabilities</option>
          {filters.capabilities.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {filters.statuses.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {applications.map((application) => (
          <article key={application.applicationId} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">{application.displayName}</h3>
                <p className="mt-1 text-xs text-zinc-400">{application.company} | {application.category}</p>
              </div>
              <span className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{application.health.state}</span>
            </div>

            <p className="mt-3 text-sm text-zinc-300">{application.description}</p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <Pill label="Version" value={application.version} />
              <Pill label="Status" value={application.registrationStatus} />
              <Pill label="Readiness" value={application.health.readiness} />
              <Pill label="Liveness" value={application.health.liveness} />
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {application.capabilities.map((entry) => (
                <span key={entry} className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300">{entry}</span>
              ))}
            </div>

            {application.launch.launchAllowed && application.launch.safeLaunchTarget && application.launch.resolvedLaunchType ? (
              <a
                href={application.launch.safeLaunchTarget}
                target={application.launch.resolvedLaunchType === "EXTERNAL" ? "_blank" : undefined}
                rel={application.launch.resolvedLaunchType === "EXTERNAL" ? "noreferrer" : undefined}
                className="mt-4 inline-flex rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500"
              >
                Launch ({application.launch.resolvedLaunchType})
              </a>
            ) : (
              <div className="mt-4 inline-flex rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300">
                {launchBlockReasonLabel(application.launch.launchBlockReason)}
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 lg:grid-cols-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-200">Navigation: Companies</h4>
          <p className="mt-2 text-xs text-zinc-400">{workspace.navigation.companies.join(", ") || "None"}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-200">Navigation: Categories</h4>
          <p className="mt-2 text-xs text-zinc-400">{workspace.navigation.categories.join(", ") || "None"}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-200">Capability Overview</h4>
          <p className="mt-2 text-xs text-zinc-400">{workspace.capabilityOverview.capabilityCount} capabilities</p>
          <p className="mt-1 text-xs text-zinc-500">{workspace.capabilityOverview.capabilities.join(", ")}</p>
        </div>
      </section>
    </div>
  );
}
