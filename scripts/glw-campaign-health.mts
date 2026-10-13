import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateThreeCampaignHealth } from "../src/modules/glw/campaign-health-supervisor";

const args = new Set(process.argv.slice(2)); const json = args.has("--json"); const reconcile = args.has("--reconcile") || args.has("--recover");
const root = process.env.GCP_FOUNDATION_PERSISTENCE_DIR?.trim() || join(process.cwd(), ".gcp-foundation-data");
const load = (name: string) => JSON.parse(readFileSync(join(root, `${name}.json`), "utf8")).data;
const report = evaluateThreeCampaignHealth({ campaigns: load("glw-campaign-repository").campaigns, targets: load("glw-campaign-target-repository").targets, executions: load("glw-page-execution-repository").records, products: load("product-repository").products });
if (reconcile) {
  for (const action of report.safeRecoveryActions) {
    const response = await fetch(`http://localhost:3002/api/glw/campaigns/${action.campaignId}/reconcile`, { method: "POST", headers: { "Content-Type": "application/json", "x-gcp-roles": "platform_admin", "x-gcp-organization-id": action.campaignId.includes("led-display-warehouse") ? "led-display-warehouse" : "ssi" }, body: JSON.stringify({ confirm: "RECONCILE_EXISTING_DRAFT_BATCH" }) });
    if (!response.ok) throw new Error(`Reconciliation failed for ${action.campaignId}: HTTP ${response.status}`);
  }
}
if (json) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`GLW CAMPAIGN HEALTH: ${report.healthy ? "HEALTHY" : "ATTENTION REQUIRED"}`);
  for (const campaign of report.campaigns) console.log(`${campaign.campaignId}: present=${campaign.present} reference=${campaign.referenceCount} stuck=${campaign.stuckRunning} unreconciled=${campaign.unreconciledComplete} unauthorizedPublished=${campaign.unauthorizedPublished} counts=${JSON.stringify(campaign.counts)}`);
  for (const product of report.products) console.log(`${product.productId}: ${product.healthy ? "healthy" : "unhealthy"}`);
  for (const finding of report.findings) console.log(`${finding.severity} ${finding.code}: ${finding.action}`);
  if (!reconcile && report.safeRecoveryActions.length) console.log("Safe reconciliation is available with --reconcile. No publication, dispatch, generation, activation, or target creation is performed.");
}
process.exitCode = report.findings.some((finding) => finding.severity === "ERROR") ? 1 : 0;