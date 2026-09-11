"use client";

import React from "react";
import type { GlwCampaignManagerRecord, GlwCampaignStateCoverage } from "./campaign-manager";
import { GLW_US_MAP_VIEW_BOX, GLW_US_STATE_GEOMETRY } from "./us-state-geometry";

type RecordWithProposal = GlwCampaignManagerRecord & { proposal: { name: string; originReason: string } | null };

const STATUS_STYLES = {
  completed: { fill: "#166534", stroke: "#4ade80", label: "Completed" },
  active: { fill: "#075985", stroke: "#38bdf8", label: "Active" },
  incomplete: { fill: "#92400e", stroke: "#fbbf24", label: "Incomplete" },
  uncovered: { fill: "#27272a", stroke: "#71717a", label: "Uncovered" },
} as const;

export function CampaignGeographicMap({ coverage, records, products, productFilter, selectedStates, selectedState, onProductFilter, onToggleState, onSelectState, onUseSelection, onSelectStatus, onClear }: {
  coverage: readonly GlwCampaignStateCoverage[];
  records: readonly RecordWithProposal[];
  products: readonly { productId: string; name: string }[];
  productFilter: string;
  selectedStates: readonly string[];
  selectedState: string;
  onProductFilter: (productId: string) => void;
  onToggleState: (stateCode: string) => void;
  onSelectState: (stateCode: string) => void;
  onUseSelection: () => void;
  onSelectStatus: (status: "uncovered" | "incomplete") => void;
  onClear: () => void;
}) {
  const coverageByCode = new Map(coverage.map((state) => [state.code, state]));
  const detail = coverageByCode.get(selectedState) ?? coverage[0];
  const stateCampaigns = detail ? records.filter((record) => record.campaign.stateCodes.includes(detail.code) && (!productFilter || record.campaign.productId === productFilter)) : [];
  const cityCampaigns = stateCampaigns.filter((record) => record.campaign.pageType === "city_service");
  const nextSuggestion = stateCampaigns.find((record) => record.proposal)?.proposal;

  return <section className="border border-zinc-800 bg-zinc-950 p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Campaign Reach</p><h2 className="mt-1 text-xl font-bold text-white">United States coverage</h2></div>
      <label className="text-xs uppercase text-zinc-500">Coverage layer<select aria-label="Coverage layer" value={productFilter} onChange={(event) => onProductFilter(event.target.value)} className="mt-2 block min-w-56 border border-zinc-700 bg-zinc-900 p-2 text-sm normal-case text-white"><option value="">All campaigns</option>{products.map((product) => <option key={product.productId} value={product.productId}>{product.name}</option>)}</select></label>
    </div>
    <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-300" aria-label="Campaign coverage legend">{Object.entries(STATUS_STYLES).map(([status, style]) => <span key={status} className="flex items-center gap-2"><i className="h-3 w-3 border" style={{ backgroundColor: style.fill, borderColor: style.stroke }} />{style.label}</span>)}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
      <div className="max-w-full overflow-x-auto rounded-sm border border-zinc-800 bg-zinc-900/50 p-2">
        <svg viewBox={GLW_US_MAP_VIEW_BOX} className="block min-w-[680px]" role="img" aria-label="Geographic United States campaign coverage map">
          <title>Geographic United States campaign coverage map</title>
          {GLW_US_STATE_GEOMETRY.map((geometry) => {
            const state = coverageByCode.get(geometry.code);
            const style = STATUS_STYLES[state?.state ?? "uncovered"];
            const selected = selectedStates.includes(geometry.code);
            return <path key={geometry.code} d={geometry.path} fill={style.fill} stroke={selected ? "#ffffff" : style.stroke} strokeWidth={selected ? 2.8 : 1.2} vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-label={`${geometry.name}: ${style.label}; ${state?.completedCount ?? 0} of ${state?.targetCount ?? 0} targets complete`} onMouseEnter={() => onSelectState(geometry.code)} onFocus={() => onSelectState(geometry.code)} onClick={() => { onSelectState(geometry.code); onToggleState(geometry.code); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectState(geometry.code); onToggleState(geometry.code); } }} className="cursor-pointer transition-opacity hover:opacity-80 focus:outline-none" />;
          })}
        </svg>
      </div>
      {detail ? <aside className="border border-zinc-800 bg-zinc-900/60 p-4" aria-live="polite"><p className="text-xs uppercase tracking-[0.18em] text-zinc-500">State detail</p><h3 className="mt-1 text-lg font-bold text-white">{detail.name}</h3><span className="mt-3 inline-flex border px-2 py-1 text-xs font-bold" style={{ borderColor: STATUS_STYLES[detail.state].stroke, color: STATUS_STYLES[detail.state].stroke }}>{STATUS_STYLES[detail.state].label}</span><dl className="mt-4 grid grid-cols-[1fr_auto] gap-2 text-sm"><dt className="text-zinc-400">Targets</dt><dd className="text-white">{detail.completedCount}/{detail.targetCount} complete</dd><dt className="text-zinc-400">Failed</dt><dd className="text-white">{detail.failedCount}</dd><dt className="text-zinc-400">Campaigns</dt><dd className="text-white">{stateCampaigns.length}</dd><dt className="text-zinc-400">City campaigns</dt><dd className="text-white">{cityCampaigns.length}</dd></dl>{stateCampaigns.length > 0 ? <ul className="mt-4 space-y-2 border-t border-zinc-800 pt-3">{stateCampaigns.map((record) => <li key={record.campaign.campaignId} className="text-xs"><span className="font-semibold text-zinc-200">{record.campaign.name}</span><span className="block text-zinc-500">{record.campaign.pageType === "city_service" ? "City" : "State"} · {record.completedCount}/{record.summary.total} complete</span></li>)}</ul> : <p className="mt-4 text-sm text-zinc-400">No campaign coverage yet.</p>}{nextSuggestion ? <div className="mt-4 border-t border-zinc-800 pt-3"><p className="text-xs uppercase text-emerald-400">Next expansion</p><p className="mt-1 text-sm font-semibold text-white">{nextSuggestion.name}</p></div> : null}</aside> : null}
    </div>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={onUseSelection} disabled={selectedStates.length === 0} className="border border-red-500 bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:border-zinc-700 disabled:bg-zinc-800">Use selected states ({selectedStates.length})</button><button type="button" onClick={() => onSelectStatus("uncovered")} className="border border-zinc-700 px-3 py-2 text-sm text-zinc-200">Select uncovered states</button><button type="button" onClick={() => onSelectStatus("incomplete")} className="border border-zinc-700 px-3 py-2 text-sm text-zinc-200">Select incomplete states</button><button type="button" onClick={onClear} className="px-3 py-2 text-sm text-zinc-400">Clear</button></div>
    <details className="mt-5 border-t border-zinc-800 pt-4"><summary className="cursor-pointer text-sm text-zinc-300">Accessible state details</summary><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{coverage.map((state) => <button key={state.code} type="button" onClick={() => { onSelectState(state.code); onToggleState(state.code); }} className="border border-zinc-800 p-2 text-left text-xs"><b className="text-white">{state.code}</b><span className="block text-zinc-500">{STATUS_STYLES[state.state].label}</span></button>)}</div></details>
  </section>;
}
