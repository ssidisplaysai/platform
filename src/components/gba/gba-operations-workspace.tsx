import React from "react";
import Link from "next/link";
import type { GbaOperationsRoutePermissions } from "@/app/glw/(protected)/operations-agent/access";
import { createPrismaOperationsRepository } from "@/lib/gba/operations-repository";
import { createOperationsRuntimeService } from "@/lib/gba/operations-runtime";

type OperationsWorkspaceMode =
  | "dashboard"
  | "work-orders"
  | "production"
  | "warehouse"
  | "inventory"
  | "purchasing"
  | "shipping"
  | "capacity"
  | "kpis"
  | "recommendations"
  | "vendors"
  | "timeline"
  | "health";

const LABEL: Record<OperationsWorkspaceMode, string> = {
  dashboard: "Dashboard",
  "work-orders": "Work Orders",
  production: "Production Scheduling",
  warehouse: "Warehouse",
  inventory: "Inventory",
  purchasing: "Purchasing",
  shipping: "Shipping",
  capacity: "Capacity",
  kpis: "KPIs",
  recommendations: "Recommendations",
  vendors: "Vendors",
  timeline: "Timeline",
  health: "Health",
};

const WORKSPACE_ID = "glw-led-display-warehouse";
const ORGANIZATION_ID = "genesis";

export async function GbaOperationsWorkspace({ mode, permissions }: { mode: OperationsWorkspaceMode; permissions: GbaOperationsRoutePermissions }) {
  const repository = createPrismaOperationsRepository();
  const runtime = createOperationsRuntimeService(repository);

  const [
    dashboard,
    workOrders,
    production,
    warehouse,
    inventory,
    purchasing,
    shipping,
    capacity,
    kpis,
    recommendations,
    vendors,
    timeline,
    health,
    summaries,
  ] = await Promise.all([
    runtime.getDashboard(WORKSPACE_ID, ORGANIZATION_ID),
    runtime.listWorkOrders(WORKSPACE_ID),
    runtime.listProductionSchedules(WORKSPACE_ID),
    runtime.listWarehouseOperations(WORKSPACE_ID),
    runtime.listInventory(WORKSPACE_ID),
    runtime.listPurchasing(WORKSPACE_ID),
    runtime.listShipping(WORKSPACE_ID),
    runtime.listCapacity(WORKSPACE_ID),
    runtime.listOperationsKpis(WORKSPACE_ID),
    runtime.listRecommendations(WORKSPACE_ID),
    runtime.listVendorMetrics(WORKSPACE_ID),
    runtime.listTimeline(WORKSPACE_ID),
    runtime.listHealth(WORKSPACE_ID),
    runtime.listExecutiveSummaries(WORKSPACE_ID),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Business Agents</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">GBA Operations Agent Workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">Operational command surface for work orders, scheduling, inventory, warehouse, purchasing, shipping, capacity, and KPI-driven optimization.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/glw/operations-agent" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Dashboard</Link>
          <Link href="/glw/operations-agent/work-orders" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Work Orders</Link>
          <Link href="/glw/operations-agent/production" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Production</Link>
          <Link href="/glw/operations-agent/warehouse" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Warehouse</Link>
          <Link href="/glw/operations-agent/inventory" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Inventory</Link>
          <Link href="/glw/operations-agent/purchasing" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Purchasing</Link>
          <Link href="/glw/operations-agent/shipping" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Shipping</Link>
          <Link href="/glw/operations-agent/capacity" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Capacity</Link>
          <Link href="/glw/operations-agent/kpis" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">KPIs</Link>
          <Link href="/glw/operations-agent/recommendations" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Recommendations</Link>
          <Link href="/glw/operations-agent/vendors" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Vendors</Link>
          <Link href="/glw/operations-agent/timeline" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Timeline</Link>
          <Link href="/glw/operations-agent/health" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Health</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Work Orders</p><p className="mt-2 text-2xl text-white">{workOrders.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Inventory</p><p className="mt-2 text-2xl text-white">{dashboard.inventory.value.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Warehouse</p><p className="mt-2 text-2xl text-white">{dashboard.warehouse.value.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Capacity</p><p className="mt-2 text-2xl text-white">{dashboard.capacity.value.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Recommendations</p><p className="mt-2 text-2xl text-white">{recommendations.length}</p></article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current View</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{LABEL[mode]}</h2>

        {mode === "dashboard" ? (
          <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Manufacturing score: {dashboard.manufacturing.value.toFixed(0)} ({dashboard.manufacturing.trend.toFixed(1)} trend)</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Production throughput: {dashboard.production.value.toFixed(0)} units/day</p>
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Field operations score: {dashboard.fieldOperations.value.toFixed(0)}</p>
          </div>
        ) : null}

        {mode === "work-orders" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Work order management: {permissions.canManageWorkOrders ? "enabled" : "restricted"}</p>
            {workOrders.length === 0 ? <p className="text-zinc-400">No work orders available.</p> : workOrders.slice(0, 30).map((entry) => (
              <p key={entry.workOrderId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.title} - {entry.priority} - {entry.status} - {entry.completionPercent}%</p>
            ))}
          </div>
        ) : null}

        {mode === "production" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {production.length === 0 ? <p className="text-zinc-400">No schedule records.</p> : production.slice(0, 30).map((entry) => (
              <p key={entry.scheduleId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.queueName} ({entry.shiftCode}) - machine {entry.machineId} - {entry.plannedUnits} units</p>
            ))}
          </div>
        ) : null}

        {mode === "warehouse" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Warehouse management: {permissions.canManageWarehouse ? "enabled" : "restricted"}</p>
            {warehouse.length === 0 ? <p className="text-zinc-400">No warehouse operation records.</p> : warehouse.slice(0, 30).map((entry) => (
              <p key={entry.warehouseOperationId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.operationType} - {entry.referenceId} - zone {entry.zone} - {entry.status}</p>
            ))}
          </div>
        ) : null}

        {mode === "inventory" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Inventory management: {permissions.canManageInventory ? "enabled" : "restricted"}</p>
            {inventory.length === 0 ? <p className="text-zinc-400">No inventory records.</p> : inventory.slice(0, 30).map((entry) => (
              <p key={entry.inventoryRecordId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.sku} - available {entry.availableQuantity} / on-hand {entry.onHandQuantity} - reorder {entry.reorderPoint}</p>
            ))}
          </div>
        ) : null}

        {mode === "purchasing" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Purchasing management: {permissions.canManagePurchasing ? "enabled" : "restricted"}</p>
            {purchasing.length === 0 ? <p className="text-zinc-400">No purchasing records.</p> : purchasing.slice(0, 30).map((entry) => (
              <p key={entry.purchasingId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.purchaseOrderNumber} - {entry.vendorId} - {entry.status} - lead time {entry.leadTimeDays}d</p>
            ))}
          </div>
        ) : null}

        {mode === "shipping" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Shipping management: {permissions.canManageShipping ? "enabled" : "restricted"}</p>
            {shipping.length === 0 ? <p className="text-zinc-400">No shipment records.</p> : shipping.slice(0, 30).map((entry) => (
              <p key={entry.shippingId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.shipmentType} - {entry.carrier} - {entry.trackingNumber} - {entry.status}</p>
            ))}
          </div>
        ) : null}

        {mode === "capacity" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {capacity.length === 0 ? <p className="text-zinc-400">No capacity records.</p> : capacity.slice(0, 30).map((entry) => (
              <p key={entry.capacityId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Machine {entry.machineUtilizationPercent}% - Labor {entry.laborUtilizationPercent}% - Forecast {entry.forecastDemandUnits}</p>
            ))}
          </div>
        ) : null}

        {mode === "kpis" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {kpis.length === 0 ? <p className="text-zinc-400">No KPIs configured.</p> : kpis.slice(0, 30).map((entry) => (
              <p key={entry.operationsKpiId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.name} - target {entry.target}{entry.unit} - latest {entry.latest?.measuredValue ?? "n/a"}</p>
            ))}
          </div>
        ) : null}

        {mode === "recommendations" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Recommendation review: {permissions.canReviewRecommendations ? "enabled" : "restricted"}</p>
            {recommendations.length === 0 ? <p className="text-zinc-400">No recommendations available.</p> : recommendations.slice(0, 30).map((entry) => (
              <p key={entry.operationsRecommendationId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.category} - {entry.title} - {entry.priority} - {entry.confidence}</p>
            ))}
          </div>
        ) : null}

        {mode === "vendors" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {vendors.length === 0 ? <p className="text-zinc-400">No vendor metrics available.</p> : vendors.slice(0, 30).map((entry) => (
              <p key={entry.vendorMetricId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.vendorId} - OTD {entry.onTimeDeliveryRate}% - Quality {entry.qualityAcceptanceRate}%</p>
            ))}
          </div>
        ) : null}

        {mode === "timeline" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {timeline.length === 0 ? <p className="text-zinc-400">No timeline events available.</p> : timeline.slice(0, 30).map((entry) => (
              <p key={entry.operationsTimelineEventId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.eventType} - {entry.summary}</p>
            ))}
          </div>
        ) : null}

        {mode === "health" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Health visibility: {permissions.canViewHealth ? "enabled" : "restricted"}</p>
            {health.length === 0 ? <p className="text-zinc-400">No health snapshots available.</p> : health.slice(0, 20).map((entry) => (
              <p key={entry.operationsHealthId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.status} - blocked {entry.blockedWorkOrderCount} - low stock {entry.lowStockSkuCount} - delayed {entry.delayedShipmentCount}</p>
            ))}
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">Executive summaries: {summaries.length}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
