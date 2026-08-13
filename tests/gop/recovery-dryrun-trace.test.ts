import { describe, expect, it } from "@jest/globals";
import { createJobRecoveryService } from "@/lib/runtime/job-recovery";

describe("recovery dry-run trace instrumentation", () => {
  it("omitted dryRun resolves to true", async () => {
    const service = createJobRecoveryService({
      glwJob: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
      gopExecution: { findFirst: async () => null },
      gopWorker: { findMany: async () => [], findUnique: async () => null },
      gopExecutionLease: { count: async () => 0, updateMany: async () => ({ count: 0 }) },
      gopRecoveryRecord: { create: async () => ({}) },
      $queryRaw: async () => [{ regclass: null }],
      $executeRaw: async () => 0,
      $transaction: async (fn: any) => fn({
        glwJob: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
        gopExecution: { findFirst: async () => null },
        gopWorker: { findMany: async () => [], findUnique: async () => null },
        gopExecutionLease: { count: async () => 0, updateMany: async () => ({ count: 0 }) },
        gopRecoveryRecord: { create: async () => ({}) },
        $queryRaw: async () => [{ regclass: null }],
        $executeRaw: async () => 0,
      }),
    } as any);

    const result = await service.executeRecovery({
      actorId: "user@example.com",
      mode: "RECOVER_ALL_SAFE",
    });

    expect(result.dryRun).toBe(true);
  });

  it("explicit true stays true", async () => {
    const service = createJobRecoveryService({
      glwJob: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
      gopExecution: { findFirst: async () => null },
      gopWorker: { findMany: async () => [], findUnique: async () => null },
      gopExecutionLease: { count: async () => 0, updateMany: async () => ({ count: 0 }) },
      gopRecoveryRecord: { create: async () => ({}) },
      $queryRaw: async () => [{ regclass: null }],
      $executeRaw: async () => 0,
      $transaction: async (fn: any) => fn({
        glwJob: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
        gopExecution: { findFirst: async () => null },
        gopWorker: { findMany: async () => [], findUnique: async () => null },
        gopExecutionLease: { count: async () => 0, updateMany: async () => ({ count: 0 }) },
        gopRecoveryRecord: { create: async () => ({}) },
        $queryRaw: async () => [{ regclass: null }],
        $executeRaw: async () => 0,
      }),
    } as any);

    const result = await service.executeRecovery({
      actorId: "user@example.com",
      mode: "RECOVER_ALL_SAFE",
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
  });

  it("explicit false remains false", async () => {
    const service = createJobRecoveryService({
      glwJob: { count: async () => 0, findFirst: async () => null, findMany: async () => [], update: async () => ({}) },
      gopExecution: { findFirst: async () => ({ executionId: "exec-1", status: "RUNNING" }) },
      gopWorker: { findMany: async () => [], findUnique: async () => null },
      gopExecutionLease: { count: async () => 0, updateMany: async () => ({ count: 0 }) },
      gopRecoveryRecord: { create: async () => ({}) },
      $queryRaw: async () => [{ regclass: "public.GopRecoveryRecord" }],
      $executeRaw: async () => 0,
      $transaction: async (fn: any) => fn({
        glwJob: { count: async () => 0, findFirst: async () => null, findMany: async () => [], update: async () => ({}) },
        gopExecution: { findFirst: async () => ({ executionId: "exec-1", status: "RUNNING" }) },
        gopWorker: { findMany: async () => [], findUnique: async () => null },
        gopExecutionLease: { count: async () => 0, updateMany: async () => ({ count: 0 }) },
        gopRecoveryRecord: { create: async () => ({}) },
        $queryRaw: async () => [{ regclass: "public.GopRecoveryRecord" }],
        $executeRaw: async () => 0,
      }),
    } as any);

    const result = await service.executeRecovery({
      actorId: "user@example.com",
      mode: "RECOVER_ALL_SAFE",
      dryRun: false,
      approvalToken: "APPROVE_RECOVERY_WRITE",
      reason: "Diagnostic trace",
    });

    expect(result.dryRun).toBe(false);
  });

  it("write authorization remains required for false", async () => {
    const service = createJobRecoveryService({
      glwJob: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
      gopExecution: { findFirst: async () => null },
      gopWorker: { findMany: async () => [], findUnique: async () => null },
      gopExecutionLease: { count: async () => 0, updateMany: async () => ({ count: 0 }) },
      gopRecoveryRecord: { create: async () => ({}) },
      $queryRaw: async () => [{ regclass: null }],
      $executeRaw: async () => 0,
      $transaction: async (fn: any) => fn({
        glwJob: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
        gopExecution: { findFirst: async () => null },
        gopWorker: { findMany: async () => [], findUnique: async () => null },
        gopExecutionLease: { count: async () => 0, updateMany: async () => ({ count: 0 }) },
        gopRecoveryRecord: { create: async () => ({}) },
        $queryRaw: async () => [{ regclass: null }],
        $executeRaw: async () => 0,
      }),
    } as any);

    await expect(service.executeRecovery({
      actorId: "user@example.com",
      mode: "RECOVER_ALL_SAFE",
      dryRun: false,
    })).rejects.toThrow(/approval token/i);
  });
});
