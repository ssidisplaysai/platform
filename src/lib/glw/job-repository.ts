import { Prisma, PrismaClient } from "@prisma/client";
import { getPrismaClient } from "./prisma";
import {
  GlwJobRecord,
  GlwJobRepository,
  parseGlwJobRecord,
  toJsonValue,
} from "./jobs";

type PrismaGlwJobRecord = Awaited<ReturnType<PrismaClient["glwJob"]["create"]>> & {
  operationKey?: string | null;
  businessStatus?: GlwJobRecord["businessStatus"];
  callbackDeliveryStatus?: GlwJobRecord["callbackDeliveryStatus"];
  terminalReceiptId?: string | null;
  publicationKey?: string | null;
};

function toRecord(value: PrismaGlwJobRecord): GlwJobRecord {
  return parseGlwJobRecord(value);
}

export function createPrismaGlwJobRepository(prisma = getPrismaClient()): GlwJobRepository {
  return {
    async create(data: GlwJobRecord): Promise<GlwJobRecord> {
      const created = await prisma.glwJob.create({
        data: {
          id: data.id,
          type: data.type,
          status: data.status,
          retryOfJobId: data.retryOfJobId,
          siteId: data.siteId,
          title: data.title,
          input: toJsonValue(data.input),
          result: data.result ? toJsonValue(data.result) : Prisma.JsonNull,
          error: data.error ? toJsonValue(data.error) : Prisma.JsonNull,
          externalExecutionId: data.externalExecutionId,
          startedAt: data.startedAt ? new Date(data.startedAt) : null,
          completedAt: data.completedAt ? new Date(data.completedAt) : null,
        },
      });

      return toRecord(created);
    },

    async update(id: string, changes: Partial<GlwJobRecord>): Promise<GlwJobRecord> {
      const updated = await prisma.glwJob.update({
        where: { id },
        data: {
          type: changes.type,
          status: changes.status,
          retryOfJobId: changes.retryOfJobId,
          siteId: changes.siteId,
          title: changes.title,
          input: changes.input ? toJsonValue(changes.input) : undefined,
          result: changes.result ? toJsonValue(changes.result) : changes.result === null ? Prisma.JsonNull : undefined,
          error: changes.error ? toJsonValue(changes.error) : changes.error === null ? Prisma.JsonNull : undefined,
          externalExecutionId: changes.externalExecutionId,
          startedAt: changes.startedAt === undefined ? undefined : changes.startedAt ? new Date(changes.startedAt) : null,
          completedAt: changes.completedAt === undefined ? undefined : changes.completedAt ? new Date(changes.completedAt) : null,
        },
      });

      return toRecord(updated);
    },

    async findById(id: string): Promise<GlwJobRecord | null> {
      const job = await prisma.glwJob.findUnique({ where: { id } });

      return job ? toRecord(job) : null;
    },

    async findRecentPageGenerationJobs(limit: number): Promise<GlwJobRecord[]> {
      const jobs = await prisma.glwJob.findMany({
        where: { type: "PAGE_GENERATION" },
        orderBy: [{ createdAt: "desc" }],
        take: limit,
      });

      return jobs.map(toRecord);
    },

    async findPageGenerationJobs(limit: number): Promise<GlwJobRecord[]> {
      const jobs = await prisma.glwJob.findMany({
        where: { type: "PAGE_GENERATION" },
        orderBy: [{ createdAt: "desc" }],
        take: limit,
      });

      return jobs.map(toRecord);
    },

    async findLatestRetryForJob(jobId: string): Promise<GlwJobRecord | null> {
      const latestRetry = await prisma.glwJob.findFirst({
        where: { retryOfJobId: jobId },
        orderBy: [{ createdAt: "desc" }],
      });

      return latestRetry ? toRecord(latestRetry) : null;
    },
  };
}

export function createInMemoryGlwJobRepository(initialJobs: GlwJobRecord[] = []): GlwJobRepository {
  const jobs = new Map<string, GlwJobRecord>(initialJobs.map((job) => [job.id, job]));

  return {
    async create(data: GlwJobRecord): Promise<GlwJobRecord> {
      jobs.set(data.id, data);
      return data;
    },

    async update(id: string, changes: Partial<GlwJobRecord>): Promise<GlwJobRecord> {
      const current = jobs.get(id);

      if (!current) {
        throw new Error(`GLW job not found: ${id}`);
      }

      const updated: GlwJobRecord = {
        ...current,
        ...changes,
        retryOfJobId: changes.retryOfJobId === undefined ? current.retryOfJobId : changes.retryOfJobId,
        input: changes.input ?? current.input,
        result: changes.result === undefined ? current.result : changes.result,
        error: changes.error === undefined ? current.error : changes.error,
        externalExecutionId: changes.externalExecutionId === undefined ? current.externalExecutionId : changes.externalExecutionId,
        startedAt: changes.startedAt === undefined ? current.startedAt : changes.startedAt,
        completedAt: changes.completedAt === undefined ? current.completedAt : changes.completedAt,
        updatedAt: new Date().toISOString(),
      };

      jobs.set(id, updated);
      return updated;
    },

    async findById(id: string): Promise<GlwJobRecord | null> {
      return jobs.get(id) ?? null;
    },

    async findRecentPageGenerationJobs(limit: number): Promise<GlwJobRecord[]> {
      return [...jobs.values()]
        .filter((job) => job.type === "PAGE_GENERATION")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit);
    },

    async findPageGenerationJobs(limit: number): Promise<GlwJobRecord[]> {
      return [...jobs.values()]
        .filter((job) => job.type === "PAGE_GENERATION")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit);
    },

    async findLatestRetryForJob(jobId: string): Promise<GlwJobRecord | null> {
      const latestRetry = [...jobs.values()]
        .filter((job) => job.retryOfJobId === jobId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

      return latestRetry ?? null;
    },
  };
}
