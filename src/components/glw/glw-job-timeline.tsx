import type { GlwJobTimelineEntry, GlwJobTimelineState } from "@/lib/glw/jobs";

type GlwJobTimelineProps = {
  entries: GlwJobTimelineEntry[];
  className?: string;
};

function stateStyles(state: GlwJobTimelineState): string {
  switch (state) {
    case "complete":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "active":
      return "border-white/20 bg-white text-zinc-950";
    case "failed":
      return "border-rose-500/50 bg-rose-500/15 text-rose-200";
    case "pending":
    default:
      return "border-zinc-700 bg-zinc-950 text-zinc-500";
  }
}

function stateGlyph(state: GlwJobTimelineState): string {
  switch (state) {
    case "complete":
      return "✓";
    case "active":
      return ">";
    case "failed":
      return "!";
    case "pending":
    default:
      return "•";
  }
}

export function GlwJobTimeline({ entries, className }: GlwJobTimelineProps) {
  return (
    <ol className={`space-y-3 ${className ?? ""}`.trim()}>
      {entries.map((entry, index) => (
        <li key={entry.key} className="relative min-w-0 pl-8">
          {index < entries.length - 1 ? <span className="absolute left-[10px] top-6 h-full w-px bg-zinc-800" aria-hidden="true" /> : null}
          <span className={`absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${stateStyles(entry.state)}`} aria-hidden="true">
            {stateGlyph(entry.state)}
          </span>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 min-w-0">
            <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4">
              <div className="min-w-0 space-y-1">
                <p className="break-words text-sm font-medium text-white">{entry.label}</p>
                <p className="break-words text-xs uppercase tracking-[0.25em] text-zinc-500">{entry.state}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-zinc-400 md:justify-end">
                <span className="break-words">{entry.timestamp ?? "--"}</span>
                <span>{entry.duration}</span>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
