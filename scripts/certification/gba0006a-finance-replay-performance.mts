import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createInMemoryFinanceRepository } from "../../src/lib/gba/finance-repository";
import { createFinanceRuntimeService } from "../../src/lib/gba/finance-runtime";

type JsonLike = null | boolean | number | string | JsonLike[] | { [k: string]: JsonLike };

function stable(value: unknown): JsonLike {
  if (value === null || typeof value !== "object") {
    return value as JsonLike;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stable(item));
  }
  const obj = value as Record<string, unknown>;
  const volatile = new Set([
    "generatedAt",
    "asOf",
    "immutableLineage",
    "updatedAt",
    "createdAt",
    "measuredAt",
    "capturedAt",
    "postedAt",
    "dueAt",
    "reviewedAt",
  ]);
  const sortedKeys = Object.keys(obj).filter((k) => !volatile.has(k)).sort();
  const out: Record<string, JsonLike> = {};
  for (const key of sortedKeys) {
    out[key] = stable(obj[key]);
  }
  return out;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

async function bench(label: string, fn: () => Promise<unknown>, rounds = 20) {
  const times: number[] = [];
  for (let i = 0; i < rounds; i += 1) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  const total = times.reduce((sum, t) => sum + t, 0);
  const sorted = [...times].sort((a, b) => a - b);
  const avg = total / rounds;
  const p95 = sorted[Math.floor(rounds * 0.95) - 1] ?? sorted[sorted.length - 1];
  return {
    label,
    rounds,
    avgMs: Number(avg.toFixed(3)),
    minMs: Number(sorted[0].toFixed(3)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(3)),
    p95Ms: Number(p95.toFixed(3)),
  };
}

async function main() {
  const workspaceId = "glw-led-display-warehouse";
  const organizationId = "genesis";
  const repository = createInMemoryFinanceRepository();
  const runtime = createFinanceRuntimeService(repository);

  await runtime.getDashboard(workspaceId, organizationId);

  const d1 = await runtime.getDashboard(workspaceId, organizationId);
  const d2 = await runtime.getDashboard(workspaceId, organizationId);
  const p1 = await runtime.listProfitability(workspaceId, organizationId);
  const p2 = await runtime.listProfitability(workspaceId, organizationId);
  const k1 = await runtime.listKpis(workspaceId, organizationId);
  const k2 = await runtime.listKpis(workspaceId, organizationId);
  const f1 = await runtime.listForecasts(workspaceId, organizationId);
  const f2 = await runtime.listForecasts(workspaceId, organizationId);
  const r1 = await runtime.listRecommendations(workspaceId, organizationId);
  const r2 = await runtime.listRecommendations(workspaceId, organizationId);

  const replay = {
    dashboard: { hash1: digest(d1), hash2: digest(d2), deterministic: digest(d1) === digest(d2) },
    profitability: { hash1: digest(p1), hash2: digest(p2), deterministic: digest(p1) === digest(p2) },
    kpis: { hash1: digest(k1), hash2: digest(k2), deterministic: digest(k1) === digest(k2) },
    forecasts: { hash1: digest(f1), hash2: digest(f2), deterministic: digest(f1) === digest(f2) },
    recommendations: { hash1: digest(r1), hash2: digest(r2), deterministic: digest(r1) === digest(r2) },
  };

  const benchmarks = [
    await bench("dashboard_render", () => runtime.getDashboard(workspaceId, organizationId)),
    await bench("financial_summary_generation", () => runtime.getDashboard(workspaceId, organizationId)),
    await bench("forecast_calculation", () => runtime.listForecasts(workspaceId, organizationId)),
    await bench("profitability_calculation", () => runtime.listProfitability(workspaceId, organizationId)),
    await bench("kpi_calculation", () => runtime.listKpis(workspaceId, organizationId)),
    await bench("recommendation_generation", () => runtime.listRecommendations(workspaceId, organizationId)),
    await bench("health_endpoint", () => runtime.listHealth(workspaceId, organizationId)),
  ];

  console.log(JSON.stringify({ replay, benchmarks }, null, 2));
}

void main();
