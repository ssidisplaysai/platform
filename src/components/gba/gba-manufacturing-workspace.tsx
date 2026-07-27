import React from "react";
import Link from "next/link";
import type { GbaManufacturingRoutePermissions } from "@/app/glw/(protected)/manufacturing-agent/access";
import { createPrismaManufacturingRepository } from "@/lib/gba/manufacturing-repository";
import { createManufacturingRuntimeService } from "@/lib/gba/manufacturing-runtime";

type ManufacturingWorkspaceMode =
  | "dashboard"
  | "boms"
  | "routings"
  | "production-orders"
  | "machines"
  | "labor"
  | "materials"
  | "quality"
  | "costing"
  | "kpis"
  | "recommendations"
  | "timeline"
  | "health";

const LABEL: Record<ManufacturingWorkspaceMode, string> = {
  dashboard: "Dashboard",
  boms: "BOMs",
  routings: "Routings",
  "production-orders": "Production Orders",
  machines: "Machines",
  labor: "Labor",
  materials: "Materials",
  quality: "Quality",
  costing: "Costing",
  kpis: "KPIs",
  recommendations: "Recommendations",
  timeline: "Timeline",
  health: "Health",
};

const WORKSPACE_ID = "glw-led-display-warehouse";
const ORGANIZATION_ID = "genesis";

export async function GbaManufacturingWorkspace({ mode, permissions }: { mode: ManufacturingWorkspaceMode; permissions: GbaManufacturingRoutePermissions }) {
  const repository = createPrismaManufacturingRepository();
  const runtime = createManufacturingRuntimeService(repository);

  const [dashboard, boms, routings, productionOrders, machines, labor, materials, quality, costing, kpis, recommendations, timeline, health] = await Promise.all([
    runtime.getDashboard(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listBoms(WORKSPACE_ID),
    runtime.listRoutings(WORKSPACE_ID),
    runtime.listProductionOrders(WORKSPACE_ID),
    runtime.listMachines(WORKSPACE_ID),
    runtime.listLabor(WORKSPACE_ID),
    runtime.listMaterials(WORKSPACE_ID),
    runtime.listQuality(WORKSPACE_ID),
    runtime.listCosting(WORKSPACE_ID),
    runtime.listKpis(WORKSPACE_ID),
    runtime.listRecommendations(WORKSPACE_ID),
    runtime.listTimeline(WORKSPACE_ID),
    runtime.listHealth(WORKSPACE_ID),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Business Agents</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">GBA Manufacturing Agent Workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">Manufacturing command surface for BOM governance, routing integrity, production planning, machine/labor/material coordination, quality, costing, KPI control, and deterministic recommendations.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/glw/manufacturing-agent" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Dashboard</Link>
          <Link href="/glw/manufacturing-agent/boms" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">BOMs</Link>
          <Link href="/glw/manufacturing-agent/routings" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Routings</Link>
          <Link href="/glw/manufacturing-agent/production-orders" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Production Orders</Link>
          <Link href="/glw/manufacturing-agent/machines" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Machines</Link>
          <Link href="/glw/manufacturing-agent/labor" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Labor</Link>
          <Link href="/glw/manufacturing-agent/materials" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Materials</Link>
          <Link href="/glw/manufacturing-agent/quality" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Quality</Link>
          <Link href="/glw/manufacturing-agent/costing" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Costing</Link>
          <Link href="/glw/manufacturing-agent/kpis" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">KPIs</Link>
          <Link href="/glw/manufacturing-agent/recommendations" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Recommendations</Link>
          <Link href="/glw/manufacturing-agent/timeline" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Timeline</Link>
          <Link href="/glw/manufacturing-agent/health" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Health</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Production Orders</p><p className="mt-2 text-2xl text-white">{productionOrders.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Machine Utilization</p><p className="mt-2 text-2xl text-white">{dashboard.machineUtilization.value.toFixed(0)}%</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Labor Utilization</p><p className="mt-2 text-2xl text-white">{dashboard.laborUtilization.value.toFixed(0)}%</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Quality Score</p><p className="mt-2 text-2xl text-white">{dashboard.qualityScore.value.toFixed(0)}%</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Recommendations</p><p className="mt-2 text-2xl text-white">{recommendations.length}</p></article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current View</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{LABEL[mode]}</h2>

        {mode === "dashboard" ? (
          <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Active production: {dashboard.activeProduction.value}</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Forecast output: {dashboard.forecastOutput.value} units</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Downtime: {dashboard.downtimeMinutes.value} minutes</p>
          </div>
        ) : null}

        {mode === "boms" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {boms.length === 0 ? <p className="text-zinc-400">No BOM records available.</p> : boms.slice(0, 30).map((entry) => (
              <p key={entry.bomId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.sku} rev {entry.revision} - components {entry.components.length}</p>
            ))}
          </div>
        ) : null}

        {mode === "routings" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {routings.length === 0 ? <p className="text-zinc-400">No routing records available.</p> : routings.slice(0, 30).map((entry) => (
              <p key={entry.routingId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.sku} rev {entry.revision} - work center {entry.workCenter} - steps {entry.processSteps.length}</p>
            ))}
          </div>
        ) : null}

        {mode === "production-orders" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Production order management: {permissions.canManageProductionOrders ? "enabled" : "restricted"}</p>
            {productionOrders.length === 0 ? <p className="text-zinc-400">No production orders available.</p> : productionOrders.slice(0, 30).map((entry) => (
              <p key={entry.productionOrderId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.title} - {entry.priority} - {entry.status} - {entry.quantityCompleted}/{entry.quantityPlanned}</p>
            ))}
          </div>
        ) : null}

        {mode === "machines" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Machine status management: {permissions.canManageMachines ? "enabled" : "restricted"}</p>
            {machines.length === 0 ? <p className="text-zinc-400">No machine records available.</p> : machines.slice(0, 30).map((entry) => (
              <p key={entry.machineId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.machineType} - {entry.status} - util {entry.utilizationPercent}% - down {entry.downtimeMinutes}m</p>
            ))}
          </div>
        ) : null}

        {mode === "labor" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {labor.length === 0 ? <p className="text-zinc-400">No labor records available.</p> : labor.slice(0, 30).map((entry) => (
              <p key={entry.laborRecordId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.operatorId} - shift {entry.shift} - util {entry.utilizationPercent}% - efficiency {entry.laborEfficiencyPercent}%</p>
            ))}
          </div>
        ) : null}

        {mode === "materials" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {materials.length === 0 ? <p className="text-zinc-400">No material records available.</p> : materials.slice(0, 30).map((entry) => (
              <p key={entry.materialConsumptionId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Order {entry.productionOrderId} - yield {entry.yieldPercent}% - scrap {entry.scrapQuantity}</p>
            ))}
          </div>
        ) : null}

        {mode === "quality" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Quality event management: {permissions.canManageQuality ? "enabled" : "restricted"}</p>
            {quality.length === 0 ? <p className="text-zinc-400">No quality events available.</p> : quality.slice(0, 30).map((entry) => (
              <p key={entry.qualityEventId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.eventType} - {entry.severity} - {entry.defectCategory} - FPY {entry.firstPassYieldPercent}%</p>
            ))}
          </div>
        ) : null}

        {mode === "costing" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {costing.length === 0 ? <p className="text-zinc-400">No cost records available.</p> : costing.slice(0, 30).map((entry) => (
              <p key={entry.manufacturingCostId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Order {entry.productionOrderId} - total {entry.totalManufacturingCost.toFixed(0)} - variance {entry.costVariance}%</p>
            ))}
          </div>
        ) : null}

        {mode === "kpis" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {kpis.length === 0 ? <p className="text-zinc-400">No KPIs configured.</p> : kpis.slice(0, 30).map((entry) => (
              <p key={entry.manufacturingKpiId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.name} - target {entry.target}{entry.unit} - latest {entry.latest?.measuredValue ?? "n/a"}</p>
            ))}
          </div>
        ) : null}

        {mode === "recommendations" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Recommendation review: {permissions.canReviewRecommendations ? "enabled" : "restricted"}</p>
            {recommendations.length === 0 ? <p className="text-zinc-400">No recommendations available.</p> : recommendations.slice(0, 30).map((entry) => (
              <p key={entry.manufacturingRecommendationId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.category} - {entry.title} - {entry.priority} - {entry.confidence}</p>
            ))}
          </div>
        ) : null}

        {mode === "timeline" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {timeline.length === 0 ? <p className="text-zinc-400">No timeline events available.</p> : timeline.slice(0, 30).map((entry) => (
              <p key={entry.manufacturingTimelineEventId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.eventType} - {entry.summary}</p>
            ))}
          </div>
        ) : null}

        {mode === "health" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Health visibility: {permissions.canViewHealth ? "enabled" : "restricted"}</p>
            {health.length === 0 ? <p className="text-zinc-400">No health snapshots available.</p> : health.slice(0, 20).map((entry) => (
              <p key={entry.manufacturingHealthId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.status} - blocked {entry.blockedProductionOrders} - critical quality {entry.criticalQualityEvents} - downtime signals {entry.machineDowntimeSignals}</p>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
