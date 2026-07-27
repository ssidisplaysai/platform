"use client";

import React from "react";
import { useMemo, useState } from "react";

type SectionRecord = {
  sectionId: string;
  sectionKey: string;
  sectionType: string;
  position: number;
  workingHeading?: string;
  optional?: boolean;
  status?: string;
  targetWordRange?: { min: number; max: number };
  ctaType?: string;
  mediaRequirement?: Record<string, unknown>;
  internalLinkRequirement?: Record<string, unknown>;
  structuredDataContribution?: Record<string, unknown>;
  requiredKnowledgeRecords?: string[];
  requiredClaims?: string[];
  requiredEvidence?: string[];
};

type SectionListProps = {
  sections: SectionRecord[];
  canManagePlan: boolean;
  onReorder: (orderedSectionIds: string[]) => Promise<void> | void;
};

export function GmpSectionList({ sections, canManagePlan, onReorder }: SectionListProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const orderedSections = useMemo(() => [...sections].sort((left, right) => left.position - right.position), [sections]);

  async function reorder(nextOrder: string[]) {
    await onReorder(nextOrder);
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Section Planner</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Section sequencing</h3>
        </div>
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] uppercase tracking-[0.24em] text-zinc-400">Stable IDs preserved</span>
      </div>
      <div className="mt-4 space-y-3">
        {orderedSections.map((section) => (
          <div
            key={section.sectionId}
            draggable={canManagePlan}
            onDragStart={() => setDraggedId(section.sectionId)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (!draggedId || draggedId === section.sectionId) {
                return;
              }
              const next = orderedSections.map((entry) => entry.sectionId);
              const fromIndex = next.indexOf(draggedId);
              const toIndex = next.indexOf(section.sectionId);
              if (fromIndex < 0 || toIndex < 0) {
                return;
              }
              next.splice(fromIndex, 1);
              next.splice(toIndex, 0, draggedId);
              void reorder(next);
              setDraggedId(null);
            }}
            className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-white">{section.sectionKey}</p>
              <Badge>{section.sectionType}</Badge>
              <Badge>{section.optional ? "Optional" : "Required"}</Badge>
              <Badge>#{section.position}</Badge>
              <Badge>{section.status ?? "PLANNED"}</Badge>
            </div>
            <p className="mt-1 text-sm text-zinc-300">{section.workingHeading ?? "Untitled section"}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
              <span>Word range {section.targetWordRange ? `${section.targetWordRange.min}-${section.targetWordRange.max}` : "n/a"}</span>
              <span>CTA {section.ctaType ?? "n/a"}</span>
              <span>Knowledge {section.requiredKnowledgeRecords?.length ?? 0}</span>
              <span>Evidence {section.requiredEvidence?.length ?? 0}</span>
              <span>Claims {section.requiredClaims?.length ?? 0}</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs text-zinc-400">
              <DataList title="Knowledge requirements" values={section.requiredKnowledgeRecords ?? []} />
              <DataList title="Evidence requirements" values={section.requiredEvidence ?? []} />
              <DataList title="Structured data" values={[JSON.stringify(section.structuredDataContribution ?? {})]} />
            </div>
          </div>
        ))}
      </div>
      {!canManagePlan ? <p className="mt-3 text-xs text-zinc-500">Section editing is hidden because the current session lacks plan-management capability.</p> : null}
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] uppercase tracking-[0.22em] text-zinc-400">{children}</span>;
}

function DataList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2">
      <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">{title}</p>
      <p className="mt-1 text-zinc-300">{values.length > 0 ? values.join(", ") : "None"}</p>
    </div>
  );
}
