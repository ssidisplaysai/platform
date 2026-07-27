import React from "react";

type HealthScore = {
  score?: number;
  status?: string;
};

type DestinationHealthContract = {
  modelVersion?: string;
  generatedAt?: string;
  overallHealth?: HealthScore;
  connectionHealth?: HealthScore;
  credentialHealth?: HealthScore;
  capabilityHealth?: HealthScore;
  publishingHealth?: HealthScore & { successCount?: number; failedCount?: number };
  verificationHealth?: HealthScore;
  driftHealth?: HealthScore;
  blockingIssues?: string[];
  warnings?: string[];
  recommendations?: string[];
};

function scoreBadge(score?: number): string {
  if (score === undefined) return "text-zinc-300";
  if (score >= 80) return "text-emerald-300";
  if (score >= 50) return "text-amber-300";
  return "text-rose-300";
}

function Row({ label, value }: { label: string; value: HealthScore | undefined }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${scoreBadge(value?.score)}`}>
        {value?.status ?? "UNKNOWN"}{value?.score !== undefined ? ` (${value.score})` : ""}
      </p>
    </div>
  );
}

export function GmpDestinationHealth({ health }: { health: DestinationHealthContract | null | undefined }) {
  if (!health) {
    return <p className="text-sm text-zinc-400">Destination health is unavailable.</p>;
  }

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Destination Health</h2>
        <p className="text-xs text-zinc-400">{health.modelVersion ?? "unknown-model"} • {health.generatedAt ?? "no timestamp"}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Row label="Overall" value={health.overallHealth} />
        <Row label="Connection" value={health.connectionHealth} />
        <Row label="Credential" value={health.credentialHealth} />
        <Row label="Capability" value={health.capabilityHealth} />
        <Row label="Publishing" value={health.publishingHealth} />
        <Row label="Verification" value={health.verificationHealth} />
        <Row label="Drift" value={health.driftHealth} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Blocking Issues</p>
          {(health.blockingIssues ?? []).length === 0 ? <p className="text-sm text-zinc-400">None</p> : (health.blockingIssues ?? []).map((entry) => <p key={entry} className="text-sm text-rose-300">{entry}</p>)}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Warnings</p>
          {(health.warnings ?? []).length === 0 ? <p className="text-sm text-zinc-400">None</p> : (health.warnings ?? []).map((entry) => <p key={entry} className="text-sm text-amber-300">{entry}</p>)}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Recommendations</p>
          {(health.recommendations ?? []).length === 0 ? <p className="text-sm text-zinc-400">None</p> : (health.recommendations ?? []).map((entry) => <p key={entry} className="text-sm text-emerald-300">{entry}</p>)}
        </div>
      </div>
    </section>
  );
}
