import { performance } from "node:perf_hooks";
import { createInMemoryMarketingRepository } from "./src/lib/gba/marketing-repository";
import { createMarketingRuntimeService } from "./src/lib/gba/marketing-runtime";

const repository = createInMemoryMarketingRepository();
const runtime = createMarketingRuntimeService(repository);

async function measure(label: string, fn: () => Promise<unknown>) {
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const started = performance.now();
    await fn();
    samples.push(performance.now() - started);
  }
  const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  return { label, avg: Number(avg.toFixed(3)), min: Number(min.toFixed(3)), max: Number(max.toFixed(3)) };
}

(async () => {
  const dashboard = await measure("dashboard_rendering", () => runtime.getDashboard("glw-led-display-warehouse", "genesis", "project-1", "site-1"));
  const campaigns = await measure("campaign_retrieval", () => runtime.listCampaignPlans("project-1"));
  const seo = await measure("seo_analysis", () => runtime.listSeoIntelligence("project-1"));
  const recommendations = await measure("recommendation_generation", () => runtime.listRecommendations("project-1"));
  const kpis = await measure("marketing_kpi_calculations", () => runtime.listHealth("project-1"));

  console.log(JSON.stringify({ dashboard, campaigns, seo, recommendations, kpis }, null, 2));
})();