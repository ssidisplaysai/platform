import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import {
  salesId,
  type SalesAccountIntelligence,
  type SalesForecastSnapshot,
  type SalesHealthSnapshot,
  type SalesPipelineRecord,
  type SalesRecommendation,
  type SalesRecommendationReview,
  type SalesTimelineEvent,
} from "./sales-models";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type SalesRepository = {
  listPipeline: (workspaceId: string) => Promise<SalesPipelineRecord[]>;
  upsertPipelineRecord: (record: SalesPipelineRecord) => Promise<SalesPipelineRecord>;
  listForecasts: (workspaceId: string) => Promise<SalesForecastSnapshot[]>;
  upsertForecast: (record: SalesForecastSnapshot) => Promise<SalesForecastSnapshot>;
  listAccounts: (workspaceId: string) => Promise<SalesAccountIntelligence[]>;
  upsertAccount: (record: SalesAccountIntelligence) => Promise<SalesAccountIntelligence>;
  listRecommendations: (workspaceId: string) => Promise<SalesRecommendation[]>;
  upsertRecommendation: (record: SalesRecommendation) => Promise<SalesRecommendation>;
  appendRecommendationReview: (record: SalesRecommendationReview) => Promise<SalesRecommendationReview>;
  listTimeline: (workspaceId: string) => Promise<SalesTimelineEvent[]>;
  appendTimelineEvent: (record: SalesTimelineEvent) => Promise<SalesTimelineEvent>;
  listHealthSnapshots: (workspaceId: string) => Promise<SalesHealthSnapshot[]>;
  upsertHealthSnapshot: (record: SalesHealthSnapshot) => Promise<SalesHealthSnapshot>;
};

export function createInMemorySalesRepository(): SalesRepository {
  const pipeline = new Map<string, SalesPipelineRecord>();
  const forecasts = new Map<string, SalesForecastSnapshot>();
  const accounts = new Map<string, SalesAccountIntelligence>();
  const recommendations = new Map<string, SalesRecommendation>();
  const reviews = new Map<string, SalesRecommendationReview>();
  const timeline = new Map<string, SalesTimelineEvent>();
  const health = new Map<string, SalesHealthSnapshot>();

  return {
    async listPipeline(workspaceId) {
      return [...pipeline.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async upsertPipelineRecord(record) {
      pipeline.set(record.salesPipelineRecordId, record);
      return record;
    },
    async listForecasts(workspaceId) {
      return [...forecasts.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async upsertForecast(record) {
      forecasts.set(record.salesForecastSnapshotId, record);
      return record;
    },
    async listAccounts(workspaceId) {
      return [...accounts.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async upsertAccount(record) {
      accounts.set(record.salesAccountIntelligenceId, record);
      return record;
    },
    async listRecommendations(workspaceId) {
      return [...recommendations.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async upsertRecommendation(record) {
      recommendations.set(record.salesRecommendationId, record);
      return record;
    },
    async appendRecommendationReview(record) {
      reviews.set(record.salesRecommendationReviewId, record);
      const recommendation = recommendations.get(record.salesRecommendationId);
      if (recommendation) {
        recommendations.set(record.salesRecommendationId, {
          ...recommendation,
          status: record.decision,
        });
      }
      return record;
    },
    async listTimeline(workspaceId) {
      return [...timeline.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async appendTimelineEvent(record) {
      timeline.set(record.salesTimelineEventId, record);
      return record;
    },
    async listHealthSnapshots(workspaceId) {
      return [...health.values()].filter((entry) => entry.workspaceId === workspaceId).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    },
    async upsertHealthSnapshot(record) {
      health.set(record.salesHealthId, record);
      return record;
    },
  };
}

export function createPrismaSalesRepository(prisma: PrismaClient = getPrismaClient()): SalesRepository {
  return {
    async listPipeline(workspaceId) {
      const rows = await prisma.gbaSalesPipelineRecord.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        salesPipelineRecordId: row.salesPipelineRecordId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        accountId: row.accountId,
        accountName: row.accountName,
        opportunityReference: row.opportunityReference,
        stage: row.stage as SalesPipelineRecord["stage"],
        amountCents: row.amountCents,
        weightedAmountCents: row.weightedAmountCents,
        probabilityPercent: row.probabilityPercent,
        expectedCloseAt: row.expectedCloseAt.toISOString(),
        ownerId: row.ownerId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async upsertPipelineRecord(record) {
      await prisma.gbaSalesPipelineRecord.upsert({
        where: { salesPipelineRecordId: record.salesPipelineRecordId },
        create: {
          ...record,
          expectedCloseAt: new Date(record.expectedCloseAt),
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt),
        },
        update: {
          accountId: record.accountId,
          accountName: record.accountName,
          opportunityReference: record.opportunityReference,
          stage: record.stage,
          amountCents: record.amountCents,
          weightedAmountCents: record.weightedAmountCents,
          probabilityPercent: record.probabilityPercent,
          expectedCloseAt: new Date(record.expectedCloseAt),
          ownerId: record.ownerId,
          updatedAt: new Date(record.updatedAt),
          immutableLineage: record.immutableLineage,
        },
      });
      return record;
    },
    async listForecasts(workspaceId) {
      const rows = await prisma.gbaSalesForecastSnapshot.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        salesForecastSnapshotId: row.salesForecastSnapshotId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        period: row.period,
        pipelineAmountCents: row.pipelineAmountCents,
        weightedAmountCents: row.weightedAmountCents,
        committedAmountCents: row.committedAmountCents,
        modeledWinRatePercent: row.modeledWinRatePercent,
        confidence: row.confidence as SalesForecastSnapshot["confidence"],
        assumptions: (row.assumptions as string[]) ?? [],
        createdAt: row.createdAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async upsertForecast(record) {
      await prisma.gbaSalesForecastSnapshot.upsert({
        where: { salesForecastSnapshotId: record.salesForecastSnapshotId },
        create: {
          ...record,
          assumptions: toJson(record.assumptions),
          createdAt: new Date(record.createdAt),
        },
        update: {
          period: record.period,
          pipelineAmountCents: record.pipelineAmountCents,
          weightedAmountCents: record.weightedAmountCents,
          committedAmountCents: record.committedAmountCents,
          modeledWinRatePercent: record.modeledWinRatePercent,
          confidence: record.confidence,
          assumptions: toJson(record.assumptions),
          immutableLineage: record.immutableLineage,
        },
      });
      return record;
    },
    async listAccounts(workspaceId) {
      const rows = await prisma.gbaSalesAccountIntelligence.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
      return rows.map((row) => ({
        salesAccountIntelligenceId: row.salesAccountIntelligenceId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        accountId: row.accountId,
        accountName: row.accountName,
        relationshipHealthScore: row.relationshipHealthScore,
        expansionPotentialScore: row.expansionPotentialScore,
        churnRiskScore: row.churnRiskScore,
        openOpportunities: row.openOpportunities,
        openRevenueCents: row.openRevenueCents,
        signals: (row.signals as string[]) ?? [],
        updatedAt: row.updatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async upsertAccount(record) {
      await prisma.gbaSalesAccountIntelligence.upsert({
        where: { salesAccountIntelligenceId: record.salesAccountIntelligenceId },
        create: {
          ...record,
          signals: toJson(record.signals),
          updatedAt: new Date(record.updatedAt),
        },
        update: {
          accountName: record.accountName,
          relationshipHealthScore: record.relationshipHealthScore,
          expansionPotentialScore: record.expansionPotentialScore,
          churnRiskScore: record.churnRiskScore,
          openOpportunities: record.openOpportunities,
          openRevenueCents: record.openRevenueCents,
          signals: toJson(record.signals),
          updatedAt: new Date(record.updatedAt),
          immutableLineage: record.immutableLineage,
        },
      });
      return record;
    },
    async listRecommendations(workspaceId) {
      const rows = await prisma.gbaSalesRecommendation.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        salesRecommendationId: row.salesRecommendationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        category: row.category as SalesRecommendation["category"],
        title: row.title,
        summary: row.summary,
        recommendedAction: row.recommendedAction,
        priority: row.priority as SalesRecommendation["priority"],
        confidence: row.confidence as SalesRecommendation["confidence"],
        status: row.status as SalesRecommendation["status"],
        sourceReference: row.sourceReference,
        createdAt: row.createdAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async upsertRecommendation(record) {
      await prisma.gbaSalesRecommendation.upsert({
        where: { salesRecommendationId: record.salesRecommendationId },
        create: {
          ...record,
          createdAt: new Date(record.createdAt),
        },
        update: {
          category: record.category,
          title: record.title,
          summary: record.summary,
          recommendedAction: record.recommendedAction,
          priority: record.priority,
          confidence: record.confidence,
          status: record.status,
          sourceReference: record.sourceReference,
          immutableLineage: record.immutableLineage,
        },
      });
      return record;
    },
    async appendRecommendationReview(record) {
      await prisma.gbaSalesRecommendationReview.create({
        data: {
          ...record,
          reviewedAt: new Date(record.reviewedAt),
        },
      });
      await prisma.gbaSalesRecommendation.updateMany({
        where: { salesRecommendationId: record.salesRecommendationId },
        data: { status: record.decision },
      });
      return record;
    },
    async listTimeline(workspaceId) {
      const rows = await prisma.gbaSalesTimelineEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        salesTimelineEventId: row.salesTimelineEventId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        eventType: row.eventType,
        subjectId: row.subjectId,
        summary: row.summary,
        actorId: row.actorId,
        evidenceReferences: (row.evidenceReferences as string[]) ?? [],
        createdAt: row.createdAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async appendTimelineEvent(record) {
      await prisma.gbaSalesTimelineEvent.create({
        data: {
          ...record,
          evidenceReferences: toJson(record.evidenceReferences),
          createdAt: new Date(record.createdAt),
        },
      });
      return record;
    },
    async listHealthSnapshots(workspaceId) {
      const rows = await prisma.gbaSalesHealth.findMany({ where: { workspaceId }, orderBy: { generatedAt: "desc" } });
      return rows.map((row) => ({
        salesHealthId: row.salesHealthId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        status: row.status as SalesHealthSnapshot["status"],
        stalledOpportunityCount: row.stalledOpportunityCount,
        riskyAccountCount: row.riskyAccountCount,
        forecastGapCount: row.forecastGapCount,
        fulfillmentConstraintCount: row.fulfillmentConstraintCount,
        generatedAt: row.generatedAt.toISOString(),
        immutableLineage: row.immutableLineage,
      }));
    },
    async upsertHealthSnapshot(record) {
      await prisma.gbaSalesHealth.upsert({
        where: { salesHealthId: record.salesHealthId },
        create: {
          ...record,
          generatedAt: new Date(record.generatedAt),
        },
        update: {
          status: record.status,
          stalledOpportunityCount: record.stalledOpportunityCount,
          riskyAccountCount: record.riskyAccountCount,
          forecastGapCount: record.forecastGapCount,
          fulfillmentConstraintCount: record.fulfillmentConstraintCount,
          immutableLineage: record.immutableLineage,
        },
      });
      return record;
    },
  };
}

export function createSeedSalesRecommendation(input: {
  workspaceId: string;
  organizationId: string;
  category: SalesRecommendation["category"];
  title: string;
  summary: string;
  recommendedAction: string;
  priority: SalesRecommendation["priority"];
  confidence: SalesRecommendation["confidence"];
  sourceReference: string;
  createdAt: string;
  immutableLineage: string;
}): SalesRecommendation {
  return {
    salesRecommendationId: salesId("gbasalesrec"),
    workspaceId: input.workspaceId,
    organizationId: input.organizationId,
    category: input.category,
    title: input.title,
    summary: input.summary,
    recommendedAction: input.recommendedAction,
    priority: input.priority,
    confidence: input.confidence,
    status: "NEW",
    sourceReference: input.sourceReference,
    createdAt: input.createdAt,
    immutableLineage: input.immutableLineage,
  };
}
