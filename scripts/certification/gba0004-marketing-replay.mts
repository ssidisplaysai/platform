import { createInMemoryMarketingRepository } from "../../src/lib/gba/marketing-repository";
import { createMarketingRuntimeService } from "../../src/lib/gba/marketing-runtime";
import { marketingId } from "../../src/lib/gba/marketing-models";

const repository = createInMemoryMarketingRepository();
const runtime = createMarketingRuntimeService(repository);

async function main() {
  await repository.upsertRecommendation({
    marketingRecommendationId: marketingId("seededrec"),
    workspaceId: "glw-led-display-warehouse",
    organizationId: "genesis",
    projectId: "project-1",
    category: "seo",
    title: "Improve heading alignment",
    summary: "Align page heading with search intent.",
    recommendedAction: "Update the headline and supporting H2 tags.",
    priority: "P1",
    confidence: "HIGH",
    status: "NEW",
    sourceReference: "seed",
    createdAt: new Date(0).toISOString(),
    immutableLineage: "seed-lineage",
  });

  const first = await runtime.listRecommendations("project-1");
  const second = await runtime.listRecommendations("project-1");
  console.log(JSON.stringify({
    replayDeterministic: JSON.stringify(first) === JSON.stringify(second),
    signatureCount: first.length,
    firstSignatures: first.map((entry) => entry.immutableLineage),
  }, null, 2));
}

void main();
