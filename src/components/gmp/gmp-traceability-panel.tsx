"use client";

import React from "react";
import Link from "next/link";

type TraceabilityReference = {
  knowledgeWorkspaceId?: string;
  knowledgeRecordId?: string;
  knowledgeRecordVersion?: number;
  sourceId?: string;
  required?: boolean;
  role?: string;
  metadata?: Record<string, unknown>;
};

type TraceabilitySection = {
  sectionId?: string;
  sectionKey?: string;
  workingHeading?: string;
  position?: number;
  requiredKnowledgeRecords?: string[];
  requiredEvidence?: string[];
};

type TraceabilityPanelProps = {
  projectId: string;
  pageId: string;
  page: {
    knowledgeWorkspaceVersion?: number;
    brandProfileVersion?: number;
  };
  briefReferences: TraceabilityReference[];
  planReferences: TraceabilityReference[];
  sourceReferences: TraceabilityReference[];
  sections: TraceabilitySection[];
};

export function GmpTraceabilityPanel({
  projectId,
  pageId,
  page,
  briefReferences,
  planReferences,
  sourceReferences,
  sections,
}: TraceabilityPanelProps) {
  const knowledgeWorkspaceHref = `/glw/projects/${projectId}/knowledge`;
  const recordHref = `/glw/projects/${projectId}/knowledge/records`;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Knowledge Traceability</p>
      <h3 className="mt-1 text-lg font-semibold text-white">Traceability chain</h3>
      <div className="mt-4 space-y-3 text-sm text-zinc-300">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
          <p className="font-medium text-white">Knowledge Workspace</p>
          <p className="mt-1 text-zinc-400">Version {page.knowledgeWorkspaceVersion ?? 0} • Brand profile version {page.brandProfileVersion ?? 0}</p>
          <Link href={knowledgeWorkspaceHref} className="mt-2 inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-200">Open GMP-0002 workspace</Link>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
          <p className="font-medium text-white">Knowledge Records</p>
          <p className="mt-1 text-zinc-400">{briefReferences.length + planReferences.length} referenced record links</p>
          <Link href={recordHref} className="mt-2 inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-200">Open records</Link>
          <div className="mt-3 space-y-2">
            {[...briefReferences, ...planReferences].map((reference, index) => {
              const canonicalKey = typeof reference.metadata?.canonicalKey === "string" ? reference.metadata.canonicalKey : reference.knowledgeRecordId ?? "unknown";
              return (
                <div key={`${canonicalKey}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                  <p className="text-white">{canonicalKey}</p>
                  <p className="text-xs text-zinc-500">Version {reference.knowledgeRecordVersion ?? 0} • {reference.required ? "Required" : "Optional"}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
          <p className="font-medium text-white">Evidence</p>
          <p className="mt-1 text-zinc-400">{sourceReferences.length} source references</p>
          <Link href={`/glw/projects/${projectId}/knowledge/sources`} className="mt-2 inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-200">Open sources</Link>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
          <p className="font-medium text-white">Page Sections</p>
          <p className="mt-1 text-zinc-400">{sections.length} sections referencing knowledge and evidence</p>
          <div className="mt-3 space-y-2">
            {sections.map((section) => (
              <div key={section.sectionId ?? section.sectionKey} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                <p className="text-white">{section.sectionKey}</p>
                <p className="text-xs text-zinc-500">{section.workingHeading ?? "Untitled section"} • {section.position ?? 0}</p>
                <p className="text-xs text-zinc-500">Knowledge {section.requiredKnowledgeRecords?.length ?? 0} • Evidence {section.requiredEvidence?.length ?? 0}</p>
              </div>
            ))}
          </div>
          <Link href={`/glw/projects/${projectId}/pages/${pageId}/sections`} className="mt-2 inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-200">Open section planner</Link>
        </div>
      </div>
    </section>
  );
}
