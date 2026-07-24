import type { GlwJobStatus } from "./glw-data";

type StatusBadgeProps = {
  status: GlwJobStatus;
};

const statusStyles: Record<GlwJobStatus, string> = {
  running: "border-emerald-200 bg-emerald-50 text-emerald-700",
  queued: "border-zinc-200 bg-zinc-100 text-zinc-600",
  succeeded: "border-sky-200 bg-sky-50 text-sky-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
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
