type GlwJobProgressProps = {
  progress: number;
  label?: string;
  className?: string;
};

export function GlwJobProgress({ progress, label, className }: GlwJobProgressProps) {
  const safeProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={className ?? ""}>
      {label ? <div className="mb-2 flex items-center justify-between text-xs text-zinc-400"><span>{label}</span><span>{Math.round(safeProgress)}%</span></div> : null}
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
          style={{ width: `${safeProgress}%` }}
        />
      </div>
    </div>
  );
}
