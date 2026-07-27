import { createPrismaGmpRepository } from "@/lib/gmp/repository";
import { createPrismaEnterpriseDomainRepository } from "@/lib/ged/enterprise-domain-repository";
import { createEnterpriseDomainRuntimeService } from "@/lib/ged/enterprise-domain-runtime";
import { createMarketingRuntimeService } from "./marketing-runtime";
import { createPrismaMarketingRepository } from "./marketing-repository";
import { createOperationsRuntimeService } from "./operations-runtime";
import { createPrismaOperationsRepository } from "./operations-repository";
import { createManufacturingRuntimeService } from "./manufacturing-runtime";
import { createPrismaManufacturingRepository } from "./manufacturing-repository";
import {
  createSalesImmutableLineage,
  createSalesPipelineRecord,
  salesId,
  stableSalesChecksum,
  type SalesAccountIntelligence,
  type SalesDashboard,
  type SalesForecastSnapshot,
  type SalesHealthSnapshot,
  type SalesPipelineRecord,
  type SalesRecommendation,
  type SalesRecommendationReview,
  type SalesTimelineEvent,
} from "./sales-models";
import { createSeedSalesRecommendation, type SalesRepository } from "./sales-repository";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_ORGANIZATION_ID = "genesis";

export type SalesRuntimeService = {
  getDashboard: (workspaceId: string, organizationId: string) => Promise<SalesDashboard>;
  listPipeline: (workspaceId: string, organizationId: string) => Promise<SalesPipelineRecord[]>;
  createPipelineRecord: (input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    accountId: string;
    accountName: string;
    opportunityReference: string;
    stage: SalesPipelineRecord["stage"];
    amountCents: number;
    probabilityPercent: number;
    expectedCloseAt: string;
  }) => Promise<SalesPipelineRecord>;
  listForecasts: (workspaceId: string, organizationId: string) => Promise<SalesForecastSnapshot[]>;
  listAccounts: (workspaceId: string, organizationId: string) => Promise<SalesAccountIntelligence[]>;
  listRecommendations: (workspaceId: string, organizationId: string) => Promise<SalesRecommendation[]>;
  reviewRecommendation: (input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    salesRecommendationId: string;
    decision: SalesRecommendationReview["decision"];
    notes?: string;
  }) => Promise<SalesRecommendationReview>;
  listTimeline: (workspaceId: string, organizationId: string) => Promise<SalesTimelineEvent[]>;
  listHealth: (workspaceId: string, organizationId: string) => Promise<SalesHealthSnapshot[]>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function metric(key: string, label: string, unit: string, value: number, trend: number, evidenceReferences: string[]) {
  return { key, label, unit, value, trend, evidenceReferences, asOf: nowIso() };
}

export function createSalesRuntimeService(repository: SalesRepository): SalesRuntimeService {
  const gmpRepository = createPrismaGmpRepository();
  const gedRuntime = createEnterpriseDomainRuntimeService(createPrismaEnterpriseDomainRepository());
  const marketingRuntime = createMarketingRuntimeService(createPrismaMarketingRepository());
  const operationsRuntime = createOperationsRuntimeService(createPrismaOperationsRepository());
  const manufacturingRuntime = createManufacturingRuntimeService(createPrismaManufacturingRepository());

  async function resolvePrimaryProject(workspaceId: string): Promise<string | undefined> {
    try {
      const projects = await gmpRepository.listProjects(workspaceId);
      return projects[0]?.projectId;
    } catch {
      return undefined;
    }
  }

  async function ensureSeedData(workspaceId: string, organizationId: string) {
    const existingPipeline = await repository.listPipeline(workspaceId);
    if (existingPipeline.length > 0) return;

    const now = nowIso();
    const rows: SalesPipelineRecord[] = [
      createSalesPipelineRecord({
        workspaceId,
        organizationId,
        accountId: "acct-orion",
        accountName: "Orion Facilities Group",
        opportunityReference: "opp-2026-001",
        stage: "PROPOSAL",
        amountCents: 4200000,
        probabilityPercent: 55,
        expectedCloseAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        ownerId: "system",
      }),
      createSalesPipelineRecord({
        workspaceId,
        organizationId,
        accountId: "acct-nova",
        accountName: "Nova Industrial Systems",
        opportunityReference: "opp-2026-002",
        stage: "NEGOTIATION",
        amountCents: 5800000,
        probabilityPercent: 72,
        expectedCloseAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
        ownerId: "system",
      }),
    ];

    for (const row of rows) {
      await repository.upsertPipelineRecord(row);
      await repository.appendTimelineEvent({
        salesTimelineEventId: salesId("gbasalestime"),
        workspaceId,
        organizationId,
        eventType: "PIPELINE_CREATED",
        subjectId: row.salesPipelineRecordId,
        summary: `Pipeline record created for ${row.accountName}`,
        actorId: "system",
        evidenceReferences: [row.immutableLineage],
        createdAt: now,
        immutableLineage: createSalesImmutableLineage({ eventType: "PIPELINE_CREATED", rowId: row.salesPipelineRecordId }),
      });
    }

    const totalPipeline = rows.reduce((sum, row) => sum + row.amountCents, 0);
    const totalWeighted = rows.reduce((sum, row) => sum + row.weightedAmountCents, 0);

    await repository.upsertForecast({
      salesForecastSnapshotId: salesId("gbasalesfcast"),
      workspaceId,
      organizationId,
      period: "current_quarter",
      pipelineAmountCents: totalPipeline,
      weightedAmountCents: totalWeighted,
      committedAmountCents: Math.round(totalWeighted * 0.78),
      modeledWinRatePercent: 61,
      confidence: "MEDIUM",
      assumptions: [
        "Pipeline probabilities are stage-weighted using approved commercial methodology.",
        "Manufacturing and logistics constraints are reflected before commit recommendations.",
      ],
      createdAt: now,
      immutableLineage: createSalesImmutableLineage({ totalPipeline, totalWeighted, period: "current_quarter" }),
    });

    await repository.upsertAccount({
      salesAccountIntelligenceId: salesId("gbasalesacct"),
      workspaceId,
      organizationId,
      accountId: "acct-orion",
      accountName: "Orion Facilities Group",
      relationshipHealthScore: 82,
      expansionPotentialScore: 74,
      churnRiskScore: 18,
      openOpportunities: 2,
      openRevenueCents: 6200000,
      signals: ["on_time_delivery_stable", "executive_sponsor_engaged", "quote_revision_pending"],
      updatedAt: now,
      immutableLineage: createSalesImmutableLineage({ accountId: "acct-orion", updatedAt: now }),
    });
  }

  async function ensureRecommendations(workspaceId: string, organizationId: string) {
    const existing = await repository.listRecommendations(workspaceId);
    if (existing.length > 0) return existing;

    const evidence: string[] = [];

    let operationsBacklog = 0;
    let manufacturingDelaySignals = 0;
    let marketingSignalCount = 0;
    let canonicalSalesEntityCoverage = 0;

    try {
      const workOrders = await operationsRuntime.listWorkOrders(workspaceId);
      operationsBacklog = workOrders.filter((entry) => entry.status !== "COMPLETE").length;
      evidence.push("gba:operations:work-orders");
    } catch {
      // Sales recommendations must degrade gracefully when operations data is unavailable.
    }

    try {
      const productionOrders = await manufacturingRuntime.listProductionOrders(workspaceId);
      manufacturingDelaySignals = productionOrders.filter((entry) => entry.status === "BLOCKED" || entry.status === "AT_RISK").length;
      evidence.push("gba:manufacturing:production-orders");
    } catch {
      // Sales recommendations must degrade gracefully when manufacturing data is unavailable.
    }

    try {
      const projectId = await resolvePrimaryProject(workspaceId);
      if (projectId) {
        const marketingRecommendations = await marketingRuntime.listRecommendations(projectId);
        marketingSignalCount = marketingRecommendations.length;
        evidence.push("gba:marketing:recommendations");
      }
    } catch {
      // Sales recommendations must degrade gracefully when marketing data is unavailable.
    }

    try {
      const entities = await gedRuntime.listEntities();
      const salesKeys = new Set(["customer", "opportunity", "quote", "sales_order", "product"]);
      canonicalSalesEntityCoverage = entities.filter((entry) => salesKeys.has(entry.entityKey)).length;
      evidence.push("ged:domain:entities");
    } catch {
      // GED can be unavailable in partially migrated environments.
    }

    const now = nowIso();

    const generated = [
      createSeedSalesRecommendation({
        workspaceId,
        organizationId,
        category: "FULFILLMENT",
        title: "Gate commit-stage opportunities by operational readiness",
        summary: `Detected ${operationsBacklog} active operational backlog signals and ${manufacturingDelaySignals} manufacturing risk signals.`,
        recommendedAction: "Require readiness check before progressing opportunities to COMMITTED stage.",
        priority: operationsBacklog > 5 || manufacturingDelaySignals > 2 ? "P0" : "P1",
        confidence: "HIGH",
        sourceReference: "gba-cross-signal-fulfillment",
        createdAt: now,
        immutableLineage: stableSalesChecksum({ operationsBacklog, manufacturingDelaySignals }),
      }),
      createSeedSalesRecommendation({
        workspaceId,
        organizationId,
        category: "PIPELINE",
        title: "Align pipeline narrative with current demand signals",
        summary: `Marketing surfaced ${marketingSignalCount} recommendation signals for active projects.`,
        recommendedAction: "Prioritize opportunities mapped to high-intent marketing campaigns and evidence coverage.",
        priority: "P1",
        confidence: marketingSignalCount > 0 ? "MEDIUM" : "LOW",
        sourceReference: "gba-cross-signal-marketing",
        createdAt: now,
        immutableLineage: stableSalesChecksum({ marketingSignalCount }),
      }),
      createSeedSalesRecommendation({
        workspaceId,
        organizationId,
        category: "FORECAST",
        title: "Increase forecast confidence with canonical GED coverage",
        summary: `Resolved ${canonicalSalesEntityCoverage}/5 canonical sales entities from GED for model grounding.`,
        recommendedAction: "Bind forecast assumptions and account narratives to canonical GED entities and relationships.",
        priority: canonicalSalesEntityCoverage >= 4 ? "P2" : "P1",
        confidence: canonicalSalesEntityCoverage >= 4 ? "HIGH" : "MEDIUM",
        sourceReference: "ged-canonical-coverage",
        createdAt: now,
        immutableLineage: stableSalesChecksum({ canonicalSalesEntityCoverage }),
      }),
    ];

    for (const recommendation of generated) {
      await repository.upsertRecommendation(recommendation);
    }

    await repository.appendTimelineEvent({
      salesTimelineEventId: salesId("gbasalestime"),
      workspaceId,
      organizationId,
      eventType: "RECOMMENDATIONS_REFRESHED",
      subjectId: "sales-recommendations",
      summary: "Sales recommendations were refreshed from GED and cross-agent operational signals.",
      actorId: "system",
      evidenceReferences: evidence,
      createdAt: now,
      immutableLineage: createSalesImmutableLineage({ eventType: "RECOMMENDATIONS_REFRESHED", evidence }),
    });

    return repository.listRecommendations(workspaceId);
  }

  async function computeAndPersistHealth(workspaceId: string, organizationId: string): Promise<SalesHealthSnapshot> {
    const pipeline = await repository.listPipeline(workspaceId);
    const accounts = await repository.listAccounts(workspaceId);
    const forecasts = await repository.listForecasts(workspaceId);

    const stalledOpportunityCount = pipeline.filter((entry) => entry.stage === "PROSPECT" || entry.stage === "QUALIFIED").length;
    const riskyAccountCount = accounts.filter((entry) => entry.churnRiskScore >= 40 || entry.relationshipHealthScore < 60).length;
    const forecastGapCount = forecasts.filter((entry) => entry.modeledWinRatePercent < 50 || entry.confidence === "LOW").length;

    let fulfillmentConstraintCount = 0;
    try {
      const orders = await manufacturingRuntime.listProductionOrders(workspaceId);
      fulfillmentConstraintCount += orders.filter((entry) => entry.status === "BLOCKED").length;
    } catch {
      // Ignore unavailable manufacturing constraints.
    }

    try {
      const shipping = await operationsRuntime.listShipping(workspaceId);
      fulfillmentConstraintCount += shipping.filter((entry) => entry.status !== "DELIVERED").length > 10 ? 1 : 0;
    } catch {
      // Ignore unavailable logistics constraints.
    }

    const status: SalesHealthSnapshot["status"] =
      stalledOpportunityCount <= 2 && riskyAccountCount === 0 && forecastGapCount === 0 && fulfillmentConstraintCount <= 1
        ? "HEALTHY"
        : stalledOpportunityCount <= 5 && riskyAccountCount <= 2 && forecastGapCount <= 1 && fulfillmentConstraintCount <= 3
          ? "DEGRADED"
          : "BLOCKED";

    const snapshot: SalesHealthSnapshot = {
      salesHealthId: salesId("gbasaleshealth"),
      workspaceId,
      organizationId,
      status,
      stalledOpportunityCount,
      riskyAccountCount,
      forecastGapCount,
      fulfillmentConstraintCount,
      generatedAt: nowIso(),
      immutableLineage: createSalesImmutableLineage({ stalledOpportunityCount, riskyAccountCount, forecastGapCount, fulfillmentConstraintCount }),
    };

    return repository.upsertHealthSnapshot(snapshot);
  }

  return {
    async getDashboard(workspaceId, organizationId) {
      await ensureSeedData(workspaceId, organizationId);
      const [pipeline, forecasts, accounts, recommendations, health] = await Promise.all([
        repository.listPipeline(workspaceId),
        repository.listForecasts(workspaceId),
        repository.listAccounts(workspaceId),
        ensureRecommendations(workspaceId, organizationId),
        computeAndPersistHealth(workspaceId, organizationId),
      ]);

      const pipelineTotal = pipeline.reduce((sum, row) => sum + row.amountCents, 0);
      const weightedTotal = pipeline.reduce((sum, row) => sum + row.weightedAmountCents, 0);
      const committedAmount = forecasts[0]?.committedAmountCents ?? Math.round(weightedTotal * 0.75);
      const winRate = forecasts[0]?.modeledWinRatePercent ?? 58;
      const cycleTimeDays = pipeline.length === 0 ? 0 : Math.round(pipeline.reduce((sum, row) => sum + (row.stage === "NEGOTIATION" ? 42 : 28), 0) / pipeline.length);
      const accountRiskScore = accounts.length === 0 ? 0 : Math.round(accounts.reduce((sum, row) => sum + row.churnRiskScore, 0) / accounts.length);
      const fulfillmentReadiness = Math.max(0, 100 - (health.fulfillmentConstraintCount * 12 + health.stalledOpportunityCount * 6));

      return {
        workspaceId,
        organizationId,
        totalPipelineValue: metric("pipeline_total", "Total Pipeline", "USD", pipelineTotal / 100, 0.07, ["gba:sales:pipeline"]),
        weightedForecast: metric("weighted_forecast", "Weighted Forecast", "USD", weightedTotal / 100, 0.05, ["gba:sales:forecast"]),
        winRate: metric("win_rate", "Win Rate", "%", winRate, 1.2, ["gba:sales:forecast"]),
        cycleTimeDays: metric("cycle_time", "Cycle Time", "days", cycleTimeDays, -0.9, ["gba:sales:pipeline"]),
        accountRiskScore: metric("account_risk", "Account Risk", "score", accountRiskScore, -0.4, ["gba:sales:accounts"]),
        fulfillmentReadiness: metric("fulfillment_readiness", "Fulfillment Readiness", "score", fulfillmentReadiness, -0.2, ["gba:operations", "gba:manufacturing"]),
        recommendationCount: metric("recommendations", "Recommendations", "count", recommendations.length, 0.3, ["gba:sales:recommendations"]),
        generatedAt: nowIso(),
        immutableLineage: createSalesImmutableLineage({ pipelineTotal, weightedTotal, committedAmount, winRate, cycleTimeDays, accountRiskScore, fulfillmentReadiness }),
      };
    },

    async listPipeline(workspaceId, organizationId) {
      await ensureSeedData(workspaceId, organizationId);
      return repository.listPipeline(workspaceId);
    },

    async createPipelineRecord(input) {
      const record = createSalesPipelineRecord({
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        accountId: input.accountId,
        accountName: input.accountName,
        opportunityReference: input.opportunityReference,
        stage: input.stage,
        amountCents: input.amountCents,
        probabilityPercent: input.probabilityPercent,
        expectedCloseAt: input.expectedCloseAt,
        ownerId: input.actorId,
      });

      const saved = await repository.upsertPipelineRecord(record);
      await repository.appendTimelineEvent({
        salesTimelineEventId: salesId("gbasalestime"),
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        eventType: "PIPELINE_CREATED",
        subjectId: saved.salesPipelineRecordId,
        summary: `Created opportunity ${saved.opportunityReference} for ${saved.accountName}`,
        actorId: input.actorId,
        evidenceReferences: [saved.immutableLineage],
        createdAt: nowIso(),
        immutableLineage: createSalesImmutableLineage({ eventType: "PIPELINE_CREATED", id: saved.salesPipelineRecordId }),
      });

      return saved;
    },

    async listForecasts(workspaceId, organizationId) {
      await ensureSeedData(workspaceId, organizationId);
      const forecasts = await repository.listForecasts(workspaceId);
      if (forecasts.length > 0) return forecasts;

      const pipeline = await repository.listPipeline(workspaceId);
      const total = pipeline.reduce((sum, row) => sum + row.amountCents, 0);
      const weighted = pipeline.reduce((sum, row) => sum + row.weightedAmountCents, 0);

      const snapshot: SalesForecastSnapshot = {
        salesForecastSnapshotId: salesId("gbasalesfcast"),
        workspaceId,
        organizationId,
        period: "current_quarter",
        pipelineAmountCents: total,
        weightedAmountCents: weighted,
        committedAmountCents: Math.round(weighted * 0.75),
        modeledWinRatePercent: 58,
        confidence: "MEDIUM",
        assumptions: ["Derived from stage-weighted open pipeline and cross-agent fulfillment constraints."],
        createdAt: nowIso(),
        immutableLineage: createSalesImmutableLineage({ total, weighted }),
      };

      await repository.upsertForecast(snapshot);
      return repository.listForecasts(workspaceId);
    },

    async listAccounts(workspaceId, organizationId) {
      await ensureSeedData(workspaceId, organizationId);
      return repository.listAccounts(workspaceId);
    },

    async listRecommendations(workspaceId, organizationId) {
      await ensureSeedData(workspaceId, organizationId);
      return ensureRecommendations(workspaceId, organizationId);
    },

    async reviewRecommendation(input) {
      const review: SalesRecommendationReview = {
        salesRecommendationReviewId: salesId("gbasalesrev"),
        salesRecommendationId: input.salesRecommendationId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        decision: input.decision,
        notes: input.notes,
        reviewedBy: input.actorId,
        reviewedAt: nowIso(),
        immutableLineage: stableSalesChecksum({ recommendation: input.salesRecommendationId, decision: input.decision }),
      };

      await repository.appendRecommendationReview(review);
      await repository.appendTimelineEvent({
        salesTimelineEventId: salesId("gbasalestime"),
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        eventType: "RECOMMENDATION_REVIEWED",
        subjectId: input.salesRecommendationId,
        summary: `Recommendation ${input.decision.toLowerCase()} by ${input.actorId}`,
        actorId: input.actorId,
        evidenceReferences: [review.salesRecommendationReviewId],
        createdAt: nowIso(),
        immutableLineage: createSalesImmutableLineage({ eventType: "RECOMMENDATION_REVIEWED", reviewId: review.salesRecommendationReviewId }),
      });

      return review;
    },

    async listTimeline(workspaceId, organizationId) {
      await ensureSeedData(workspaceId, organizationId);
      return repository.listTimeline(workspaceId);
    },

    async listHealth(workspaceId, organizationId) {
      await ensureSeedData(workspaceId, organizationId);
      await computeAndPersistHealth(workspaceId, organizationId);
      return repository.listHealthSnapshots(workspaceId);
    },
  };
}

export const DEFAULT_SALES_WORKSPACE_ID = DEFAULT_WORKSPACE_ID;
export const DEFAULT_SALES_ORGANIZATION_ID = DEFAULT_ORGANIZATION_ID;
