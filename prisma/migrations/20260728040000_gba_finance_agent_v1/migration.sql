-- CreateTable
CREATE TABLE "GbaFinanceGeneralLedgerEntry" (
    "financeGeneralLedgerEntryId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fiscalPeriod" TEXT NOT NULL,
    "journalReference" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "debitAmountCents" DOUBLE PRECISION NOT NULL,
    "creditAmountCents" DOUBLE PRECISION NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "auditReference" TEXT NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceGeneralLedgerEntry_pkey" PRIMARY KEY ("financeGeneralLedgerEntryId")
);

-- CreateTable
CREATE TABLE "GbaFinanceChartOfAccount" (
    "financeChartOfAccountId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "balanceCents" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceChartOfAccount_pkey" PRIMARY KEY ("financeChartOfAccountId")
);

-- CreateTable
CREATE TABLE "GbaFinanceReceivable" (
    "financeReceivableId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "invoiceReference" TEXT NOT NULL,
    "outstandingAmountCents" DOUBLE PRECISION NOT NULL,
    "agingBucket" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "creditExposureCents" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceReceivable_pkey" PRIMARY KEY ("financeReceivableId")
);

-- CreateTable
CREATE TABLE "GbaFinancePayable" (
    "financePayableId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "billReference" TEXT NOT NULL,
    "outstandingAmountCents" DOUBLE PRECISION NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paymentPriority" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinancePayable_pkey" PRIMARY KEY ("financePayableId")
);

-- CreateTable
CREATE TABLE "GbaFinanceBudget" (
    "financeBudgetId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "budgetScope" TEXT NOT NULL,
    "scopeReference" TEXT NOT NULL,
    "capexBudgetCents" DOUBLE PRECISION NOT NULL,
    "opexBudgetCents" DOUBLE PRECISION NOT NULL,
    "spentCapexCents" DOUBLE PRECISION NOT NULL,
    "spentOpexCents" DOUBLE PRECISION NOT NULL,
    "varianceCents" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceBudget_pkey" PRIMARY KEY ("financeBudgetId")
);

-- CreateTable
CREATE TABLE "GbaFinanceProfitabilitySnapshot" (
    "financeProfitabilitySnapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "revenueCents" DOUBLE PRECISION NOT NULL,
    "costCents" DOUBLE PRECISION NOT NULL,
    "grossMarginPercent" DOUBLE PRECISION NOT NULL,
    "netMarginPercent" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceProfitabilitySnapshot_pkey" PRIMARY KEY ("financeProfitabilitySnapshotId")
);

-- CreateTable
CREATE TABLE "GbaFinanceForecast" (
    "financeForecastId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "revenueForecastCents" DOUBLE PRECISION NOT NULL,
    "expenseForecastCents" DOUBLE PRECISION NOT NULL,
    "cashFlowForecastCents" DOUBLE PRECISION NOT NULL,
    "profitForecastCents" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "varianceProjectionCents" DOUBLE PRECISION NOT NULL,
    "assumptions" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceForecast_pkey" PRIMARY KEY ("financeForecastId")
);

-- CreateTable
CREATE TABLE "GbaFinanceKpi" (
    "financeKpiId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "trend" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceKpi_pkey" PRIMARY KEY ("financeKpiId")
);

-- CreateTable
CREATE TABLE "GbaFinanceRecommendation" (
    "financeRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceRecommendation_pkey" PRIMARY KEY ("financeRecommendationId")
);

-- CreateTable
CREATE TABLE "GbaFinanceRecommendationReview" (
    "financeRecommendationReviewId" TEXT NOT NULL,
    "financeRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceRecommendationReview_pkey" PRIMARY KEY ("financeRecommendationReviewId")
);

-- CreateTable
CREATE TABLE "GbaFinanceExecutiveReport" (
    "financeExecutiveReportId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "strategicRisks" JSONB NOT NULL,
    "growthOpportunities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceExecutiveReport_pkey" PRIMARY KEY ("financeExecutiveReportId")
);

-- CreateTable
CREATE TABLE "GbaFinanceHealth" (
    "financeHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "overdueReceivables" INTEGER NOT NULL,
    "overduePayables" INTEGER NOT NULL,
    "budgetOverruns" INTEGER NOT NULL,
    "cashFlowRiskFlags" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceHealth_pkey" PRIMARY KEY ("financeHealthId")
);

-- CreateTable
CREATE TABLE "GbaFinanceTimelineEvent" (
    "financeTimelineEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceTimelineEvent_pkey" PRIMARY KEY ("financeTimelineEventId")
);

-- CreateIndex
CREATE INDEX "GbaFinanceGeneralLedgerEntry_workspaceId_postedAt_idx" ON "GbaFinanceGeneralLedgerEntry"("workspaceId", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceGeneralLedgerEntry_organizationId_postedAt_idx" ON "GbaFinanceGeneralLedgerEntry"("organizationId", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceGeneralLedgerEntry_accountCode_postedAt_idx" ON "GbaFinanceGeneralLedgerEntry"("accountCode", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceChartOfAccount_workspaceId_accountCode_idx" ON "GbaFinanceChartOfAccount"("workspaceId", "accountCode");

-- CreateIndex
CREATE INDEX "GbaFinanceChartOfAccount_organizationId_updatedAt_idx" ON "GbaFinanceChartOfAccount"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceReceivable_workspaceId_updatedAt_idx" ON "GbaFinanceReceivable"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceReceivable_organizationId_updatedAt_idx" ON "GbaFinanceReceivable"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceReceivable_customerId_updatedAt_idx" ON "GbaFinanceReceivable"("customerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinancePayable_workspaceId_updatedAt_idx" ON "GbaFinancePayable"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinancePayable_organizationId_updatedAt_idx" ON "GbaFinancePayable"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinancePayable_vendorId_updatedAt_idx" ON "GbaFinancePayable"("vendorId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceBudget_workspaceId_updatedAt_idx" ON "GbaFinanceBudget"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceBudget_organizationId_updatedAt_idx" ON "GbaFinanceBudget"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceBudget_period_updatedAt_idx" ON "GbaFinanceBudget"("period", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceProfitabilitySnapshot_workspaceId_capturedAt_idx" ON "GbaFinanceProfitabilitySnapshot"("workspaceId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceProfitabilitySnapshot_organizationId_capturedAt_idx" ON "GbaFinanceProfitabilitySnapshot"("organizationId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceProfitabilitySnapshot_dimension_capturedAt_idx" ON "GbaFinanceProfitabilitySnapshot"("dimension", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceForecast_workspaceId_generatedAt_idx" ON "GbaFinanceForecast"("workspaceId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceForecast_organizationId_generatedAt_idx" ON "GbaFinanceForecast"("organizationId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceForecast_period_generatedAt_idx" ON "GbaFinanceForecast"("period", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceKpi_workspaceId_measuredAt_idx" ON "GbaFinanceKpi"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceKpi_organizationId_measuredAt_idx" ON "GbaFinanceKpi"("organizationId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceKpi_name_measuredAt_idx" ON "GbaFinanceKpi"("name", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceRecommendation_workspaceId_createdAt_idx" ON "GbaFinanceRecommendation"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceRecommendation_organizationId_createdAt_idx" ON "GbaFinanceRecommendation"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceRecommendation_status_createdAt_idx" ON "GbaFinanceRecommendation"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaFinanceRecommendationReview"("workspaceId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceRecommendationReview_financeRecommendationId_review_idx" ON "GbaFinanceRecommendationReview"("financeRecommendationId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceExecutiveReport_workspaceId_createdAt_idx" ON "GbaFinanceExecutiveReport"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceExecutiveReport_organizationId_createdAt_idx" ON "GbaFinanceExecutiveReport"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceExecutiveReport_period_createdAt_idx" ON "GbaFinanceExecutiveReport"("period", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceHealth_workspaceId_generatedAt_idx" ON "GbaFinanceHealth"("workspaceId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceHealth_organizationId_generatedAt_idx" ON "GbaFinanceHealth"("organizationId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceHealth_status_generatedAt_idx" ON "GbaFinanceHealth"("status", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceTimelineEvent_workspaceId_createdAt_idx" ON "GbaFinanceTimelineEvent"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceTimelineEvent_organizationId_createdAt_idx" ON "GbaFinanceTimelineEvent"("organizationId", "createdAt" DESC);
