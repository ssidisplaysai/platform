import type {
  GlwDailyPublishPlanCandidate,
  GlwDailyPublishPlan,
  GlwDailyPublishPlanStatus,
} from "./publishing-plan";
import { getPrismaClient } from "./prisma";

export type GlwPublishingControlState = {
  siteId: string;
  paused: boolean;
  pausedAt: string | null;
  pausedBy: string | null;
  publishingEnabled: boolean;
  updatedAt: string;
};

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function buildCandidateApprovalStatus(candidate: GlwDailyPublishPlanCandidate):
  | "PENDING"
  | "APPROVED"
  | "EXCLUDED"
  | "BLOCKED"
  | "QUEUED"
  | "SKIPPED_ALREADY_QUEUED" {
  if (candidate.desiredAction.startsWith("BLOCKED") || candidate.desiredAction === "SKIP_EXISTING") {
    return "BLOCKED";
  }

  return "PENDING";
}

function toPlan(input: {
  id: string;
  siteId: string;
  generatedAt: Date;
  status: GlwDailyPublishPlanStatus;
  dailyPageLimit: number;
  hourlyPageLimit: number;
  maxConcurrentJobs: number;
  retryLimit: number;
  minimumDelaySeconds: number;
  summaryJson: unknown;
  candidates: Array<{
    id: string;
    siteId: string;
    productId: string;
    productSlug: string;
    stateName: string;
    stateSlug: string;
    cityName: string | null;
    citySlug: string | null;
    canonicalPath: string;
    desiredAction: string;
    priority: number;
    reason: string;
    existingWordPressId: string | null;
    existingStatus: string | null;
    parentProductId: string | null;
    parentStateId: string | null;
    approvalStatus: string;
    queueJobId: string | null;
  }>;
}): GlwDailyPublishPlan {
  const candidates: GlwDailyPublishPlanCandidate[] = input.candidates.map((candidate) => ({
    siteId: candidate.siteId,
    productId: candidate.productId,
    productSlug: candidate.productSlug,
    stateName: candidate.stateName,
    stateSlug: candidate.stateSlug,
    cityName: candidate.cityName ?? undefined,
    citySlug: candidate.citySlug ?? undefined,
    canonicalPath: candidate.canonicalPath,
    desiredAction: candidate.desiredAction as GlwDailyPublishPlanCandidate["desiredAction"],
    priority: candidate.priority,
    reason: candidate.reason,
    existingWordPressId: candidate.existingWordPressId ?? undefined,
    existingStatus: candidate.existingStatus ?? undefined,
    parentProductId: candidate.parentProductId ?? undefined,
    parentStateId: candidate.parentStateId ?? undefined,
  }));

  const approved = candidates.filter((candidate) => {
    const row = input.candidates.find((entry) => entry.canonicalPath === candidate.canonicalPath);
    return row?.approvalStatus === "APPROVED" || row?.approvalStatus === "QUEUED";
  });

  const blocked = candidates.filter((candidate) => {
    const row = input.candidates.find((entry) => entry.canonicalPath === candidate.canonicalPath);
    return row?.approvalStatus === "BLOCKED" || row?.approvalStatus === "EXCLUDED" || row?.approvalStatus === "SKIPPED_ALREADY_QUEUED";
  });

  const summary = (typeof input.summaryJson === "object" && input.summaryJson !== null
    ? input.summaryJson
    : {
      totalCandidates: candidates.length,
      approvedCount: approved.length,
      blockedCount: blocked.length,
      queuedToday: 0,
      running: 0,
      qaFailed: 0,
      duplicates: 0,
      missing: 0,
    }) as GlwDailyPublishPlan["summary"];

  return {
    planId: input.id,
    siteId: input.siteId,
    generatedAt: input.generatedAt.toISOString(),
    status: input.status,
    limits: {
      dailyPageLimit: input.dailyPageLimit,
      hourlyPageLimit: input.hourlyPageLimit,
      maxConcurrentJobs: input.maxConcurrentJobs,
      retryLimit: input.retryLimit,
      minimumDelaySeconds: input.minimumDelaySeconds,
      productRotation: [],
      stateRotation: [],
    },
    candidates,
    approved,
    blocked,
    summary,
  };
}

export async function getGlwPublishingControl(
  siteId: string,
  publishingEnabled = true,
): Promise<GlwPublishingControlState> {
  const prisma = getPrismaClient();
  const row = await prisma.glwPublishingControl.upsert({
    where: { siteId },
    create: {
      siteId,
      paused: false,
      pausedAt: null,
      pausedBy: null,
      publishingEnabled,
    },
    update: {
      publishingEnabled,
    },
  });

  return {
    siteId: row.siteId,
    paused: row.paused,
    pausedAt: toIso(row.pausedAt),
    pausedBy: row.pausedBy,
    publishingEnabled: row.publishingEnabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function pauseGlwPublishing(siteId: string, pausedBy?: string): Promise<GlwPublishingControlState> {
  const prisma = getPrismaClient();
  const row = await prisma.glwPublishingControl.upsert({
    where: { siteId },
    create: {
      siteId,
      paused: true,
      pausedAt: new Date(),
      pausedBy: pausedBy ?? null,
      publishingEnabled: true,
    },
    update: {
      paused: true,
      pausedAt: new Date(),
      pausedBy: pausedBy ?? null,
    },
  });

  return {
    siteId: row.siteId,
    paused: row.paused,
    pausedAt: toIso(row.pausedAt),
    pausedBy: row.pausedBy,
    publishingEnabled: row.publishingEnabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function resumeGlwPublishing(siteId: string): Promise<GlwPublishingControlState> {
  const prisma = getPrismaClient();
  const row = await prisma.glwPublishingControl.upsert({
    where: { siteId },
    create: {
      siteId,
      paused: false,
      pausedAt: null,
      pausedBy: null,
      publishingEnabled: true,
    },
    update: {
      paused: false,
      pausedAt: null,
      pausedBy: null,
    },
  });

  return {
    siteId: row.siteId,
    paused: row.paused,
    pausedAt: toIso(row.pausedAt),
    pausedBy: row.pausedBy,
    publishingEnabled: row.publishingEnabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function storeGlwDailyPublishPlan(plan: GlwDailyPublishPlan): Promise<GlwDailyPublishPlan> {
  const prisma = getPrismaClient();

  await prisma.$transaction(async (tx) => {
    await tx.glwDailyPublishPlan.upsert({
      where: { id: plan.planId },
      create: {
        id: plan.planId,
        siteId: plan.siteId,
        generatedAt: new Date(plan.generatedAt),
        status: plan.status,
        dailyPageLimit: plan.limits.dailyPageLimit,
        hourlyPageLimit: plan.limits.hourlyPageLimit,
        maxConcurrentJobs: plan.limits.maxConcurrentJobs,
        retryLimit: plan.limits.retryLimit,
        minimumDelaySeconds: plan.limits.minimumDelaySeconds,
        summaryJson: plan.summary,
      },
      update: {
        siteId: plan.siteId,
        generatedAt: new Date(plan.generatedAt),
        status: plan.status,
        dailyPageLimit: plan.limits.dailyPageLimit,
        hourlyPageLimit: plan.limits.hourlyPageLimit,
        maxConcurrentJobs: plan.limits.maxConcurrentJobs,
        retryLimit: plan.limits.retryLimit,
        minimumDelaySeconds: plan.limits.minimumDelaySeconds,
        summaryJson: plan.summary,
      },
    });

    await tx.glwDailyPublishCandidate.deleteMany({ where: { planId: plan.planId } });

    if (plan.candidates.length > 0) {
      await tx.glwDailyPublishCandidate.createMany({
        data: plan.candidates.map((candidate) => ({
          planId: plan.planId,
          siteId: candidate.siteId,
          productId: candidate.productId,
          productSlug: candidate.productSlug,
          stateName: candidate.stateName,
          stateSlug: candidate.stateSlug,
          cityName: candidate.cityName ?? null,
          citySlug: candidate.citySlug ?? null,
          canonicalPath: candidate.canonicalPath,
          desiredAction: candidate.desiredAction,
          priority: candidate.priority,
          reason: candidate.reason,
          existingWordPressId: candidate.existingWordPressId ? String(candidate.existingWordPressId) : null,
          existingStatus: candidate.existingStatus ?? null,
          parentProductId: candidate.parentProductId ?? null,
          parentStateId: candidate.parentStateId ?? null,
          approvalStatus: buildCandidateApprovalStatus(candidate),
          queueJobId: null,
        })),
      });
    }

    await tx.glwDailyPublishCandidate.updateMany({
      where: {
        planId: plan.planId,
        canonicalPath: {
          in: plan.approved.map((candidate) => candidate.canonicalPath),
        },
      },
      data: {
        approvalStatus: "APPROVED",
      },
    });

    await tx.glwDailyPublishCandidate.updateMany({
      where: {
        planId: plan.planId,
        canonicalPath: {
          in: plan.blocked.map((candidate) => candidate.canonicalPath),
        },
      },
      data: {
        approvalStatus: "BLOCKED",
      },
    });
  });

  const persisted = await getGlwDailyPublishPlan(plan.planId);
  if (!persisted) {
    throw new Error(`Unable to persist daily publish plan: ${plan.planId}`);
  }

  return persisted;
}

export async function getGlwDailyPublishPlan(planId: string): Promise<GlwDailyPublishPlan | null> {
  const prisma = getPrismaClient();
  const row = await prisma.glwDailyPublishPlan.findUnique({
    where: { id: planId },
    include: {
      candidates: {
        orderBy: [{ priority: "asc" }, { canonicalPath: "asc" }],
      },
    },
  });

  if (!row) {
    return null;
  }

  return toPlan(row);
}

export async function getLatestGlwDailyPublishPlanForSite(siteId: string): Promise<GlwDailyPublishPlan | null> {
  const prisma = getPrismaClient();
  const row = await prisma.glwDailyPublishPlan.findFirst({
    where: { siteId },
    orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      candidates: {
        orderBy: [{ priority: "asc" }, { canonicalPath: "asc" }],
      },
    },
  });

  return row ? toPlan(row) : null;
}

export async function listGlwDailyPublishPlans(siteId?: string): Promise<GlwDailyPublishPlan[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.glwDailyPublishPlan.findMany({
    where: siteId ? { siteId } : undefined,
    orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      candidates: {
        orderBy: [{ priority: "asc" }, { canonicalPath: "asc" }],
      },
    },
  });

  return rows.map(toPlan);
}

export async function updateGlwDailyPublishPlanStatus(planId: string, status: GlwDailyPublishPlanStatus): Promise<GlwDailyPublishPlan | null> {
  const prisma = getPrismaClient();
  await prisma.glwDailyPublishPlan.update({
    where: { id: planId },
    data: { status },
  }).catch(() => null);

  return getGlwDailyPublishPlan(planId);
}

export async function markGlwPlanCandidates(planId: string, input: { approvedCandidateIds?: string[]; excludedCandidateIds?: string[] }): Promise<GlwDailyPublishPlan | null> {
  const prisma = getPrismaClient();

  await prisma.$transaction(async (tx) => {
    if (input.approvedCandidateIds && input.approvedCandidateIds.length > 0) {
      await tx.glwDailyPublishCandidate.updateMany({
        where: {
          planId,
          canonicalPath: { in: input.approvedCandidateIds },
        },
        data: {
          approvalStatus: "APPROVED",
        },
      });
    }

    if (input.excludedCandidateIds && input.excludedCandidateIds.length > 0) {
      await tx.glwDailyPublishCandidate.updateMany({
        where: {
          planId,
          canonicalPath: { in: input.excludedCandidateIds },
        },
        data: {
          approvalStatus: "EXCLUDED",
        },
      });
    }
  });

  return getGlwDailyPublishPlan(planId);
}

export async function updateGlwPlanCandidateQueueResult(
  planId: string,
  canonicalPath: string,
  input: {
    queueJobId?: string | null;
    approvalStatus?: "APPROVED" | "EXCLUDED" | "BLOCKED" | "PENDING" | "QUEUED" | "SKIPPED_ALREADY_QUEUED";
  },
): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.glwDailyPublishCandidate.updateMany({
    where: {
      planId,
      canonicalPath,
    },
    data: {
      queueJobId: input.queueJobId ?? undefined,
      approvalStatus: input.approvalStatus ?? undefined,
    },
  });
}

export async function resetGlwPlanStoreForTests(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.glwDailyPublishCandidate.deleteMany();
  await prisma.glwDailyPublishPlan.deleteMany();
  await prisma.glwPublishingControl.deleteMany();
}
