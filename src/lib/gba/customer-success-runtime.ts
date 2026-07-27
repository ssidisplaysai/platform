import { createExecutiveRuntimeService } from "./executive-runtime";
import { createPrismaExecutiveRepository } from "./executive-repository";
import { createFinanceRuntimeService } from "./finance-runtime";
import { createPrismaFinanceRepository } from "./finance-repository";
import { createManufacturingRuntimeService } from "./manufacturing-runtime";
import { createPrismaManufacturingRepository } from "./manufacturing-repository";
import { createMarketingRuntimeService } from "./marketing-runtime";
import { createPrismaMarketingRepository } from "./marketing-repository";
import { createOperationsRuntimeService } from "./operations-runtime";
import { createPrismaOperationsRepository } from "./operations-repository";
import { createSalesRuntimeService } from "./sales-runtime";
import { createPrismaSalesRepository } from "./sales-repository";
import {
  createCustomerSuccessImmutableLineage,
  customerSuccessId,
  customerSuccessNowIso,
  stableCustomerSuccessChecksum,
  type CustomerSuccessDashboard,
  type CustomerSuccessExecutiveReport,
  type CustomerSuccessExpansionOpportunity,
  type CustomerSuccessHealthRecord,
  type CustomerSuccessHealthSnapshot,
  type CustomerSuccessKpi,
  type CustomerSuccessOnboardingRecord,
  type CustomerSuccessPlan,
  type CustomerSuccessRecommendation,
  type CustomerSuccessRecommendationReview,
  type CustomerSuccessRenewal,
  type CustomerSuccessSatisfaction,
  type CustomerSuccessSupportSignal,
  type CustomerSuccessTimelineEvent,
} from "./customer-success-models";
import type { CustomerSuccessRepository } from "./customer-success-repository";

export type CustomerSuccessRuntimeService = {
  getDashboard: (workspaceId: string, organizationId: string) => Promise<CustomerSuccessDashboard>;
  listCustomerHealth: (workspaceId: string, organizationId: string) => Promise<CustomerSuccessHealthRecord[]>;
  listOnboarding: (workspaceId: string, organizationId: string) => Promise<CustomerSuccessOnboardingRecord[]>;
  listSuccessPlans: (workspaceId: string, organizationId: string) => Promise<CustomerSuccessPlan[]>;
  listRenewals: (workspaceId: string, organizationId: string) => Promise<CustomerSuccessRenewal[]>;
  listSatisfaction: (workspaceId: string, organizationId: string) => Promise<CustomerSuccessSatisfaction[]>;
  listKpis: (workspaceId: string, organizationId: string) => Promise<CustomerSuccessKpi[]>;
  listRecommendations: (workspaceId: string, organizationId: string) => Promise<CustomerSuccessRecommendation[]>;
  reviewRecommendation: (input: {
    workspaceId: string;
    organizationId: string;
    actorId: string;
    customerSuccessRecommendationId: string;
    decision: CustomerSuccessRecommendationReview["decision"];
    notes?: string;
  }) => Promise<CustomerSuccessRecommendationReview>;
  listExecutiveReports: (workspaceId: string, organizationId: string) => Promise<CustomerSuccessExecutiveReport[]>;
  listTimeline: (workspaceId: string, organizationId: string) => Promise<CustomerSuccessTimelineEvent[]>;
  listHealth: (workspaceId: string, organizationId: string) => Promise<CustomerSuccessHealthSnapshot[]>;
};

function metric(key: string, label: string, unit: string, value: number, trend: number, evidenceReferences: string[]) {
  return { key, label, unit, value, trend, asOf: customerSuccessNowIso(), evidenceReferences };
}

export function createCustomerSuccessRuntimeService(repository: CustomerSuccessRepository): CustomerSuccessRuntimeService {
  const salesRuntime = createSalesRuntimeService(createPrismaSalesRepository());
  const marketingRuntime = createMarketingRuntimeService(createPrismaMarketingRepository());
  const financeRuntime = createFinanceRuntimeService(createPrismaFinanceRepository());
  const operationsRuntime = createOperationsRuntimeService(createPrismaOperationsRepository());
  const manufacturingRuntime = createManufacturingRuntimeService(createPrismaManufacturingRepository());
  const executiveRuntime = createExecutiveRuntimeService(createPrismaExecutiveRepository());

  async function ensureSeed(workspaceId: string, organizationId: string) {
    const existing = await repository.listOnboarding(workspaceId);
    if (existing.length > 0) return;

    const now = customerSuccessNowIso();

    const [salesAccounts, salesForecasts, marketingDashboard, financeDashboard, operationsDashboard, manufacturingCosting, executiveDashboard] = await Promise.all([
      salesRuntime.listAccounts(workspaceId, organizationId).catch(() => []),
      salesRuntime.listForecasts(workspaceId, organizationId).catch(() => []),
      marketingRuntime.getDashboard(workspaceId, organizationId).catch(() => null),
      financeRuntime.getDashboard(workspaceId, organizationId).catch(() => null),
      operationsRuntime.getDashboard(workspaceId, organizationId).catch(() => null),
      manufacturingRuntime.listCosting(workspaceId).catch(() => []),
      executiveRuntime.getDashboard(workspaceId, organizationId).catch(() => null),
    ]);

    const customerRows = [
      { id: "CUS-ORION", name: "Orion Facilities Group" },
      { id: "CUS-NOVA", name: "Nova Industrial Systems" },
    ];

    const onboardingRows: CustomerSuccessOnboardingRecord[] = customerRows.map((customer, index) => ({
      customerSuccessOnboardingId: customerSuccessId("gbacsonboard"),
      workspaceId,
      organizationId,
      customerId: customer.id,
      customerName: customer.name,
      status: index === 0 ? "IN_PROGRESS" : "READY_FOR_GO_LIVE",
      implementationMilestones: ["Kickoff complete", "Environment configured", "Integration baseline validated"],
      trainingProgressPercent: index === 0 ? 62 : 84,
      documentationCompletionPercent: index === 0 ? 58 : 90,
      goLiveReadinessPercent: index === 0 ? 64 : 88,
      adoptionCheckpointPercent: index === 0 ? 48 : 76,
      ownerId: "system",
      updatedAt: now,
      immutableLineage: createCustomerSuccessImmutableLineage({ customer, type: "onboarding", now }),
    }));

    const healthRows: CustomerSuccessHealthRecord[] = customerRows.map((customer, index) => {
      const operationalScore = operationsDashboard ? Number(operationsDashboard.capacity.value) : 72;
      const financialScore = financeDashboard ? Number(financeDashboard.cashFlowTrend.value > 0 ? 82 : 61) : 75;
      const adoptionScore = salesAccounts[index]?.relationshipHealthScore ?? (index === 0 ? 66 : 79);
      const supportScore = index === 0 ? 58 : 81;
      const satisfactionScore = index === 0 ? 71 : 88;
      const overall = Math.round((adoptionScore + supportScore + satisfactionScore + financialScore + operationalScore) / 5);

      return {
        customerSuccessHealthId: customerSuccessId("gbacshealth"),
        workspaceId,
        organizationId,
        customerId: customer.id,
        customerName: customer.name,
        overallHealthScore: overall,
        trendDirection: overall >= 80 ? "IMPROVING" : overall >= 65 ? "STABLE" : "DECLINING",
        riskLevel: overall >= 80 ? "LOW" : overall >= 65 ? "MEDIUM" : overall >= 50 ? "HIGH" : "CRITICAL",
        productAdoptionScore: adoptionScore,
        renewalHistoryScore: index === 0 ? 68 : 85,
        supportInteractionScore: supportScore,
        engagementScore: marketingDashboard ? Number(marketingDashboard.analyticsSignalScore) : index === 0 ? 63 : 82,
        satisfactionScore,
        executiveEscalationScore: executiveDashboard ? Number(executiveDashboard.customerHealth.value) : 74,
        financialStandingScore: financialScore,
        operationalDeliveryScore: operationalScore,
        recommendedActions: overall < 70
          ? ["Schedule executive sponsor sync", "Prioritize adoption playbook execution", "Increase support check-in frequency"]
          : ["Continue milestone cadence", "Prepare expansion discovery motion"],
        measuredAt: now,
        immutableLineage: createCustomerSuccessImmutableLineage({ customer, overall, now }),
      };
    });

    const planRows: CustomerSuccessPlan[] = customerRows.map((customer) => ({
      customerSuccessPlanId: customerSuccessId("gbacsplan"),
      workspaceId,
      organizationId,
      customerId: customer.id,
      customerName: customer.name,
      strategicObjectives: ["Increase operational adoption", "Stabilize business outcomes"],
      customerGoals: ["Achieve first 90-day success milestones", "Reduce escalation events"],
      milestones: ["Go-live readiness review", "Executive checkpoint", "Quarterly value realization"],
      actionItems: ["Monthly adoption review", "Weekly support triage"],
      reviewSchedule: "MONTHLY",
      successOutcomes: ["Improved retention probability", "Higher adoption utilization"],
      updatedAt: now,
      immutableLineage: createCustomerSuccessImmutableLineage({ customer, type: "plan", now }),
    }));

    const renewalBaseline = salesForecasts.reduce((sum, forecast) => sum + forecast.weightedAmountCents, 0);
    const renewalRows: CustomerSuccessRenewal[] = customerRows.map((customer, index) => ({
      customerSuccessRenewalId: customerSuccessId("gbacsrenew"),
      workspaceId,
      organizationId,
      customerId: customer.id,
      customerName: customer.name,
      contractReference: index === 0 ? "CON-ORION-2027" : "CON-NOVA-2027",
      contractExpiresAt: new Date(Date.now() + (index === 0 ? 45 : 95) * 86400000).toISOString(),
      renewalProbabilityPercent: index === 0 ? 67 : 88,
      renewalForecastCents: Math.round((renewalBaseline || 4200000) * (index === 0 ? 0.24 : 0.31)),
      churnRiskPercent: index === 0 ? 34 : 14,
      escalationRequired: index === 0,
      recommendationSummary: index === 0 ? "Executive renewal support and adoption recovery plan required." : "Proceed with standard renewal motion and expansion discovery.",
      updatedAt: now,
      immutableLineage: createCustomerSuccessImmutableLineage({ customer, type: "renewal", now }),
    }));

    const satisfactionRows: CustomerSuccessSatisfaction[] = customerRows.map((customer, index) => ({
      customerSuccessSatisfactionId: customerSuccessId("gbacssat"),
      workspaceId,
      organizationId,
      customerId: customer.id,
      customerName: customer.name,
      csatScore: index === 0 ? 7.1 : 8.8,
      npsScore: index === 0 ? 21 : 46,
      sentimentTrend: index === 0 ? "NEUTRAL" : "POSITIVE",
      surveySummary: index === 0 ? "Customer acknowledges progress but requests faster issue closure." : "Customer reports strong outcomes and onboarding confidence.",
      feedbackHighlights: index === 0 ? ["Need faster response times", "More training depth"] : ["Clear value delivery", "Strong collaboration"],
      measuredAt: now,
      immutableLineage: createCustomerSuccessImmutableLineage({ customer, type: "satisfaction", now }),
    }));

    const supportRows: CustomerSuccessSupportSignal[] = customerRows.map((customer, index) => ({
      customerSuccessSupportSignalId: customerSuccessId("gbacssupport"),
      workspaceId,
      organizationId,
      customerId: customer.id,
      customerName: customer.name,
      openIssues: index === 0 ? 6 : 2,
      escalations: index === 0 ? 2 : 0,
      resolutionProgressPercent: index === 0 ? 63 : 89,
      slaPerformancePercent: index === 0 ? 78 : 96,
      communicationSummary: index === 0 ? "Weekly executive updates required until backlog normalizes." : "Standard cadence active and stable.",
      updatedAt: now,
      immutableLineage: createCustomerSuccessImmutableLineage({ customer, type: "support", now }),
    }));

    const expansionRows: CustomerSuccessExpansionOpportunity[] = customerRows.map((customer, index) => ({
      customerSuccessExpansionOpportunityId: customerSuccessId("gbacsexpand"),
      workspaceId,
      organizationId,
      customerId: customer.id,
      customerName: customer.name,
      opportunityType: index === 0 ? "CROSS_SELL" : "UPSELL",
      productAdoptionGap: index === 0 ? "Limited adoption in analytics module" : "Opportunity to expand automation modules",
      growthIndicator: index === 0 ? "Recent campaign engagement increase" : "Consistent high adoption and satisfaction",
      projectedRevenueCents: index === 0 ? 5400000 : 8700000,
      confidenceScore: index === 0 ? 62 : 82,
      recommendationSummary: index === 0 ? "Address onboarding blockers before expansion push." : "Initiate executive-led expansion qualification.",
      updatedAt: now,
      immutableLineage: createCustomerSuccessImmutableLineage({ customer, type: "expansion", now }),
    }));

    const kpis: CustomerSuccessKpi[] = [
      { customerSuccessKpiId: customerSuccessId("gbacskpi"), workspaceId, organizationId, name: "Customer Health Score", value: 76.5, unit: "score", target: 80, trend: 0.04, measuredAt: now, immutableLineage: stableCustomerSuccessChecksum({ name: "health", now }) },
      { customerSuccessKpiId: customerSuccessId("gbacskpi"), workspaceId, organizationId, name: "Retention Rate", value: 93.2, unit: "%", target: 92, trend: 0.02, measuredAt: now, immutableLineage: stableCustomerSuccessChecksum({ name: "retention", now }) },
      { customerSuccessKpiId: customerSuccessId("gbacskpi"), workspaceId, organizationId, name: "Renewal Rate", value: 89.1, unit: "%", target: 90, trend: -0.01, measuredAt: now, immutableLineage: stableCustomerSuccessChecksum({ name: "renewal", now }) },
      { customerSuccessKpiId: customerSuccessId("gbacskpi"), workspaceId, organizationId, name: "Churn Rate", value: 6.8, unit: "%", target: 6, trend: -0.03, measuredAt: now, immutableLineage: stableCustomerSuccessChecksum({ name: "churn", now }) },
      { customerSuccessKpiId: customerSuccessId("gbacskpi"), workspaceId, organizationId, name: "Expansion Revenue", value: 141000, unit: "USD", target: 130000, trend: 0.06, measuredAt: now, immutableLineage: stableCustomerSuccessChecksum({ name: "expansion", now }) },
      { customerSuccessKpiId: customerSuccessId("gbacskpi"), workspaceId, organizationId, name: "Customer Satisfaction", value: 7.95, unit: "score", target: 8, trend: 0.02, measuredAt: now, immutableLineage: stableCustomerSuccessChecksum({ name: "satisfaction", now }) },
      { customerSuccessKpiId: customerSuccessId("gbacskpi"), workspaceId, organizationId, name: "Net Promoter Score", value: 33.5, unit: "score", target: 35, trend: 0.03, measuredAt: now, immutableLineage: stableCustomerSuccessChecksum({ name: "nps", now }) },
      { customerSuccessKpiId: customerSuccessId("gbacskpi"), workspaceId, organizationId, name: "SLA Performance", value: 87, unit: "%", target: 90, trend: 0.01, measuredAt: now, immutableLineage: stableCustomerSuccessChecksum({ name: "sla", now }) },
    ];

    const report: CustomerSuccessExecutiveReport = {
      customerSuccessExecutiveReportId: customerSuccessId("gbacsreport"),
      workspaceId,
      organizationId,
      period: "WEEKLY",
      summary: "Customer success posture is stable with targeted interventions required for at-risk renewals and onboarding delays.",
      churnForecast: "Low-to-moderate churn risk concentrated in limited subset of accounts.",
      renewalForecast: "Renewal outlook remains positive with one priority renewal escalation.",
      strategicRisks: ["Onboarding delay in one strategic account", "Support backlog pressure on renewal confidence"],
      strategicOpportunities: ["Expansion qualification in high-adoption account", "Executive outreach program for renewal confidence"],
      createdAt: now,
      immutableLineage: createCustomerSuccessImmutableLineage({ period: "WEEKLY", now }),
    };

    for (const row of onboardingRows) await repository.upsertOnboarding(row);
    for (const row of healthRows) await repository.upsertCustomerHealth(row);
    for (const row of planRows) await repository.upsertSuccessPlan(row);
    for (const row of renewalRows) await repository.upsertRenewal(row);
    for (const row of satisfactionRows) await repository.upsertSatisfaction(row);
    for (const row of supportRows) await repository.upsertSupportSignal(row);
    for (const row of expansionRows) await repository.upsertExpansionOpportunity(row);
    for (const row of kpis) await repository.upsertKpi(row);
    await repository.upsertExecutiveReport(report);

    await repository.appendTimelineEvent({
      customerSuccessTimelineEventId: customerSuccessId("gbacstime"),
      workspaceId,
      organizationId,
      eventType: "CUSTOMER_SUCCESS_BASELINE_SEEDED",
      subjectId: "customer-success-baseline",
      summary: "Customer Success baseline seeded from cross-agent lifecycle signals.",
      actorId: "system",
      evidenceReferences: ["gba:sales", "gba:marketing", "gba:finance", "gba:operations", "gba:manufacturing", "gba:executive"],
      createdAt: now,
      immutableLineage: createCustomerSuccessImmutableLineage({ eventType: "CUSTOMER_SUCCESS_BASELINE_SEEDED", now }),
    });
  }

  async function ensureRecommendations(workspaceId: string, organizationId: string) {
    const existing = await repository.listRecommendations(workspaceId);
    if (existing.length > 0) return existing;

    const [health, renewals, onboarding, support, expansions] = await Promise.all([
      repository.listCustomerHealth(workspaceId),
      repository.listRenewals(workspaceId),
      repository.listOnboarding(workspaceId),
      repository.listSupportSignals(workspaceId),
      repository.listExpansionOpportunities(workspaceId),
    ]);

    const atRisk = health.filter((entry) => entry.riskLevel === "HIGH" || entry.riskLevel === "CRITICAL");
    const renewalRisk = renewals.filter((entry) => entry.renewalProbabilityPercent < 70 || entry.churnRiskPercent > 30);
    const onboardingRisk = onboarding.filter((entry) => entry.status === "AT_RISK" || entry.goLiveReadinessPercent < 70);
    const escalations = support.filter((entry) => entry.escalations > 0);
    const expansion = expansions.filter((entry) => entry.confidenceScore >= 70);

    const recommendations: CustomerSuccessRecommendation[] = [
      {
        customerSuccessRecommendationId: customerSuccessId("gbacsrec"),
        workspaceId,
        organizationId,
        customerId: atRisk[0]?.customerId ?? "portfolio",
        customerName: atRisk[0]?.customerName ?? "Portfolio",
        category: "AT_RISK",
        title: "Prioritize at-risk account interventions",
        summary: `Detected ${atRisk.length} at-risk customer profiles requiring intervention.`,
        recommendedAction: "Trigger executive and customer success manager outreach for at-risk accounts.",
        priority: atRisk.length > 0 ? "P0" : "P2",
        confidence: "HIGH",
        status: "NEW",
        sourceReference: "customer-success:health",
        createdAt: customerSuccessNowIso(),
        immutableLineage: stableCustomerSuccessChecksum({ type: "at-risk", atRisk: atRisk.length }),
      },
      {
        customerSuccessRecommendationId: customerSuccessId("gbacsrec"),
        workspaceId,
        organizationId,
        customerId: renewalRisk[0]?.customerId ?? "portfolio",
        customerName: renewalRisk[0]?.customerName ?? "Portfolio",
        category: "RENEWAL",
        title: "Escalate renewal readiness for low-confidence contracts",
        summary: `Detected ${renewalRisk.length} renewals with elevated churn or low probability.`,
        recommendedAction: "Initiate executive renewal plan and commercial alignment for flagged contracts.",
        priority: renewalRisk.length > 0 ? "P1" : "P3",
        confidence: "MEDIUM",
        status: "NEW",
        sourceReference: "customer-success:renewals",
        createdAt: customerSuccessNowIso(),
        immutableLineage: stableCustomerSuccessChecksum({ type: "renewals", renewalRisk: renewalRisk.length }),
      },
      {
        customerSuccessRecommendationId: customerSuccessId("gbacsrec"),
        workspaceId,
        organizationId,
        customerId: onboardingRisk[0]?.customerId ?? "portfolio",
        customerName: onboardingRisk[0]?.customerName ?? "Portfolio",
        category: "ADOPTION",
        title: "Accelerate onboarding and adoption milestones",
        summary: `Detected ${onboardingRisk.length} onboarding profiles below go-live threshold.`,
        recommendedAction: "Apply intensive onboarding playbook and focused training interventions.",
        priority: onboardingRisk.length > 0 ? "P1" : "P3",
        confidence: "MEDIUM",
        status: "NEW",
        sourceReference: "customer-success:onboarding",
        createdAt: customerSuccessNowIso(),
        immutableLineage: stableCustomerSuccessChecksum({ type: "onboarding", onboardingRisk: onboardingRisk.length }),
      },
      {
        customerSuccessRecommendationId: customerSuccessId("gbacsrec"),
        workspaceId,
        organizationId,
        customerId: expansion[0]?.customerId ?? "portfolio",
        customerName: expansion[0]?.customerName ?? "Portfolio",
        category: "EXPANSION",
        title: "Advance validated expansion opportunities",
        summary: `Detected ${expansion.length} expansion opportunities with high confidence.`,
        recommendedAction: "Coordinate with Sales ownership for expansion recommendation handoff.",
        priority: expansion.length > 0 ? "P2" : "P3",
        confidence: expansion.length > 0 ? "HIGH" : "UNKNOWN",
        status: "NEW",
        sourceReference: "customer-success:expansion",
        createdAt: customerSuccessNowIso(),
        immutableLineage: stableCustomerSuccessChecksum({ type: "expansion", expansion: expansion.length }),
      },
      {
        customerSuccessRecommendationId: customerSuccessId("gbacsrec"),
        workspaceId,
        organizationId,
        customerId: escalations[0]?.customerId ?? "portfolio",
        customerName: escalations[0]?.customerName ?? "Portfolio",
        category: "ESCALATION",
        title: "Reduce support escalation load on customer outcomes",
        summary: `Detected ${escalations.length} accounts with active escalation pressure.`,
        recommendedAction: "Enforce joint success-support recovery plan and executive checkpoint cadence.",
        priority: escalations.length > 0 ? "P1" : "P3",
        confidence: "MEDIUM",
        status: "NEW",
        sourceReference: "customer-success:support",
        createdAt: customerSuccessNowIso(),
        immutableLineage: stableCustomerSuccessChecksum({ type: "support", escalations: escalations.length }),
      },
    ];

    for (const recommendation of recommendations) {
      await repository.upsertRecommendation(recommendation);
    }

    return repository.listRecommendations(workspaceId);
  }

  async function computeHealth(workspaceId: string, organizationId: string): Promise<CustomerSuccessHealthSnapshot> {
    const [health, renewals, support, onboarding] = await Promise.all([
      repository.listCustomerHealth(workspaceId),
      repository.listRenewals(workspaceId),
      repository.listSupportSignals(workspaceId),
      repository.listOnboarding(workspaceId),
    ]);

    const atRiskCustomers = health.filter((entry) => entry.riskLevel === "HIGH" || entry.riskLevel === "CRITICAL").length;
    const renewalsAtRisk = renewals.filter((entry) => entry.renewalProbabilityPercent < 70 || entry.churnRiskPercent > 30).length;
    const escalatedAccounts = support.filter((entry) => entry.escalations > 0).length;
    const onboardingDelays = onboarding.filter((entry) => entry.goLiveReadinessPercent < 70).length;

    const status: CustomerSuccessHealthSnapshot["status"] =
      atRiskCustomers === 0 && renewalsAtRisk === 0 && escalatedAccounts === 0 && onboardingDelays === 0
        ? "HEALTHY"
        : atRiskCustomers <= 1 && renewalsAtRisk <= 1 && escalatedAccounts <= 1 && onboardingDelays <= 1
          ? "DEGRADED"
          : "BLOCKED";

    return repository.upsertAgentHealth({
      customerSuccessAgentHealthId: customerSuccessId("gbacsagenthealth"),
      workspaceId,
      organizationId,
      status,
      atRiskCustomers,
      renewalsAtRisk,
      escalatedAccounts,
      onboardingDelays,
      generatedAt: customerSuccessNowIso(),
      immutableLineage: stableCustomerSuccessChecksum({ atRiskCustomers, renewalsAtRisk, escalatedAccounts, onboardingDelays }),
    });
  }

  return {
    async getDashboard(workspaceId, organizationId) {
      await ensureSeed(workspaceId, organizationId);
      const [customerHealth, onboarding, renewals, satisfaction, support, expansion, recommendations, health] = await Promise.all([
        repository.listCustomerHealth(workspaceId),
        repository.listOnboarding(workspaceId),
        repository.listRenewals(workspaceId),
        repository.listSatisfaction(workspaceId),
        repository.listSupportSignals(workspaceId),
        repository.listExpansionOpportunities(workspaceId),
        ensureRecommendations(workspaceId, organizationId),
        computeHealth(workspaceId, organizationId),
      ]);

      const activeCustomers = new Set(customerHealth.map((entry) => entry.customerId)).size;
      const avgHealth = customerHealth.length > 0 ? customerHealth.reduce((sum, entry) => sum + entry.overallHealthScore, 0) / customerHealth.length : 0;
      const onboardingProgress = onboarding.length > 0 ? onboarding.reduce((sum, entry) => sum + entry.goLiveReadinessPercent, 0) / onboarding.length : 0;
      const renewalsDue = renewals.filter((entry) => new Date(entry.contractExpiresAt).getTime() < Date.now() + 90 * 86400000).length;
      const renewalPipeline = renewals.reduce((sum, entry) => sum + entry.renewalForecastCents, 0) / 100;
      const churnRisk = renewals.length > 0 ? renewals.reduce((sum, entry) => sum + entry.churnRiskPercent, 0) / renewals.length : 0;
      const expansionCount = expansion.length;
      const satisfactionAvg = satisfaction.length > 0 ? satisfaction.reduce((sum, entry) => sum + entry.csatScore, 0) / satisfaction.length : 0;
      const supportLoad = support.reduce((sum, entry) => sum + entry.openIssues, 0);

      return {
        workspaceId,
        organizationId,
        activeCustomers: metric("active_customers", "Active Customers", "count", activeCustomers, 0.04, ["customer-success:health"]),
        customerHealthSummary: metric("health_summary", "Customer Health Summary", "score", Number(avgHealth.toFixed(2)), 0.03, ["customer-success:health"]),
        onboardingProgress: metric("onboarding_progress", "Onboarding Progress", "%", Number(onboardingProgress.toFixed(2)), 0.06, ["customer-success:onboarding"]),
        renewalsDue: metric("renewals_due", "Renewals Due", "count", renewalsDue, 0.01, ["customer-success:renewals"]),
        renewalPipeline: metric("renewal_pipeline", "Renewal Pipeline", "USD", Number(renewalPipeline.toFixed(0)), 0.05, ["customer-success:renewals"]),
        churnRiskSummary: metric("churn_risk", "Churn Risk Summary", "%", Number(churnRisk.toFixed(2)), -0.02, ["customer-success:renewals"]),
        expansionOpportunities: metric("expansion_ops", "Expansion Opportunities", "count", expansionCount, 0.07, ["customer-success:expansion"]),
        customerSatisfactionTrends: metric("satisfaction_trend", "Customer Satisfaction Trends", "score", Number(satisfactionAvg.toFixed(2)), 0.03, ["customer-success:satisfaction"]),
        supportActivitySummary: metric("support_activity", "Support Activity Summary", "count", supportLoad, -0.04, ["customer-success:support"]),
        executiveCustomerAlerts: metric("exec_alerts", "Executive Customer Alerts", "count", health.atRiskCustomers + health.renewalsAtRisk + recommendations.filter((entry) => entry.priority === "P0" || entry.priority === "P1").length, 0.09, ["customer-success:agent-health"]),
        generatedAt: customerSuccessNowIso(),
        immutableLineage: createCustomerSuccessImmutableLineage({ activeCustomers, avgHealth, onboardingProgress, renewalsDue, renewalPipeline, churnRisk, expansionCount, satisfactionAvg, supportLoad }),
      };
    },
    async listCustomerHealth(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listCustomerHealth(workspaceId); },
    async listOnboarding(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listOnboarding(workspaceId); },
    async listSuccessPlans(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listSuccessPlans(workspaceId); },
    async listRenewals(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listRenewals(workspaceId); },
    async listSatisfaction(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listSatisfaction(workspaceId); },
    async listKpis(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listKpis(workspaceId); },
    async listRecommendations(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return ensureRecommendations(workspaceId, organizationId); },
    async reviewRecommendation(input) {
      await ensureSeed(input.workspaceId, input.organizationId);
      const review: CustomerSuccessRecommendationReview = {
        customerSuccessRecommendationReviewId: customerSuccessId("gbacsrecrev"),
        customerSuccessRecommendationId: input.customerSuccessRecommendationId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        decision: input.decision,
        notes: input.notes,
        reviewedBy: input.actorId,
        reviewedAt: customerSuccessNowIso(),
        immutableLineage: stableCustomerSuccessChecksum({ recommendationId: input.customerSuccessRecommendationId, decision: input.decision }),
      };
      await repository.appendRecommendationReview(review);
      await repository.appendTimelineEvent({
        customerSuccessTimelineEventId: customerSuccessId("gbacstime"),
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        eventType: "CUSTOMER_SUCCESS_RECOMMENDATION_REVIEWED",
        subjectId: input.customerSuccessRecommendationId,
        summary: `Customer Success recommendation ${input.decision.toLowerCase()} by ${input.actorId}`,
        actorId: input.actorId,
        evidenceReferences: [review.customerSuccessRecommendationReviewId],
        createdAt: customerSuccessNowIso(),
        immutableLineage: stableCustomerSuccessChecksum({ reviewId: review.customerSuccessRecommendationReviewId }),
      });
      return review;
    },
    async listExecutiveReports(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listExecutiveReports(workspaceId); },
    async listTimeline(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); return repository.listTimeline(workspaceId); },
    async listHealth(workspaceId, organizationId) { await ensureSeed(workspaceId, organizationId); await computeHealth(workspaceId, organizationId); return repository.listAgentHealth(workspaceId); },
  };
}
