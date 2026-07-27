import { performance } from "node:perf_hooks";
import {
  createGenesisOrchestrationRuntime,
} from "../src/platform/gop/runtime/orchestrator";
import { createInMemoryExecutionRepository } from "../src/platform/gop/runtime/execution-repository";

type BenchmarkRow = {
  workers: number;
  executionsSeeded: number;
  dispatchCount: number;
  dispatchDurationMs: number;
  dispatchPerSec: number;
  dispatchLatencyP50: number;
  dispatchLatencyP95: number;
  leaseAcquisitionP50: number;
  leaseAcquisitionP95: number;
  queueWaitP50: number;
  queueWaitP95: number;
  recoveryDurationMs: number;
  replayDurationMs: number;
  throughputPerMinute: number;
  workerUtilizationAvg: number;
};

async function runOne(workers: number): Promise<BenchmarkRow> {
  const repository = createInMemoryExecutionRepository();
  const runtime = createGenesisOrchestrationRuntime({
    repository,
    bootstrapDefaultWorkers: false,
  });

  const executionCount = Math.max(workers * 3, 300);

  for (let index = 0; index < executionCount; index += 1) {
    runtime.createGlwExecutionForJob({
      jobId: `bench_${workers}_${index}`,
      jobType: "PAGE_GENERATION",
      title: `Bench ${index}`,
      siteId: "led-display-warehouse",
    });
  }

  for (let index = 0; index < workers; index += 1) {
    runtime.workers.register({
      workerId: `worker.bench.${workers}.${index}`,
      name: `Bench Worker ${index}`,
      workerType: "ai",
      capabilities: ["content.generate", "seo.optimize"],
      maxCapacity: 1,
      protocolVersion: "gop-worker/v1",
      tokenId: `token-${workers}-${index}`,
      authMode: "SIGNED_TOKEN",
    });
  }

  const dispatchStart = performance.now();
  const dispatches = runtime.dispatchPending(workers);
  const dispatchDurationMs = performance.now() - dispatchStart;

  const replayStart = performance.now();
  for (const entry of dispatches.slice(0, Math.min(50, dispatches.length))) {
    await runtime.replayExecution(entry.execution.executionId);
  }
  const replayDurationMs = performance.now() - replayStart;

  await runtime.flushPersistence();

  const recoveryStart = performance.now();
  const restarted = createGenesisOrchestrationRuntime({
    repository,
    bootstrapDefaultWorkers: false,
  });
  await restarted.ensureRecovered();
  const recoveryDurationMs = performance.now() - recoveryStart;

  const snapshot = await runtime.buildOperationsSnapshot("glw-led-display-warehouse");
  const util = snapshot.workerUtilization ?? [];
  const utilizationAvg = util.length === 0
    ? 0
    : Math.round(util.reduce((sum, item) => sum + item.utilizationPercent, 0) / util.length);

  return {
    workers,
    executionsSeeded: executionCount,
    dispatchCount: dispatches.length,
    dispatchDurationMs: Number(dispatchDurationMs.toFixed(2)),
    dispatchPerSec: dispatchDurationMs > 0 ? Number(((dispatches.length / dispatchDurationMs) * 1000).toFixed(2)) : 0,
    dispatchLatencyP50: snapshot.fabricMetrics?.dispatchLatencyMsP50 ?? 0,
    dispatchLatencyP95: snapshot.fabricMetrics?.dispatchLatencyMsP95 ?? 0,
    leaseAcquisitionP50: snapshot.fabricMetrics?.leaseAcquisitionMsP50 ?? 0,
    leaseAcquisitionP95: snapshot.fabricMetrics?.leaseAcquisitionMsP95 ?? 0,
    queueWaitP50: snapshot.fabricMetrics?.queueWaitMsP50 ?? 0,
    queueWaitP95: snapshot.fabricMetrics?.queueWaitMsP95 ?? 0,
    recoveryDurationMs: Number(recoveryDurationMs.toFixed(2)),
    replayDurationMs: Number(replayDurationMs.toFixed(2)),
    throughputPerMinute: snapshot.fabricMetrics?.throughputPerMinute ?? snapshot.throughputPerMinute,
    workerUtilizationAvg: utilizationAvg,
  };
}

async function main(): Promise<void> {
  const workerScales = [10, 100, 500, 1000];
  const rows: BenchmarkRow[] = [];

  for (const workers of workerScales) {
    rows.push(await runOne(workers));
  }

  console.log(JSON.stringify({
    benchmark: "gop-v1-certification",
    generatedAt: new Date().toISOString(),
    rows,
  }, null, 2));
}

void main();
