import type { GlwJobStatus } from "./glw-data";

type StatusBadgeProps = {
  status: GlwJobStatus;
};

const statusStyles: Record<GlwJobStatus, string> = {
  running: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  queued: "border-zinc-700 bg-zinc-800 text-zinc-300",
  succeeded: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

const statusLabels: Record<GlwJobStatus, string> = {
  running: "Running",
  queued: "Queued",
  succeeded: "Succeeded",
  failed: "Failed",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
