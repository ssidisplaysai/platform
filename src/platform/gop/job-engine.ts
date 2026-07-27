import type { GenesisJob, GenesisJobStatus } from "./contracts";
import { createGenesisTimelineFromEvents } from "./event-engine";

export const genesisJobStatusOrder: Record<GenesisJobStatus, number> = {
  QUEUED: 0,
  STARTING: 1,
  RUNNING: 2,
  GENERATING_CONTENT: 3,
  GENERATING_IMAGE: 4,
  UPLOADING_IMAGE: 5,
  VALIDATION_STARTED: 6,
  VALIDATION_PASSED: 7,
  PUBLISHING: 8,
  COMPLETE: 9,
  FAILED: 9,
  CANCELLED: 9,
  TIMED_OUT: 9,
  ARCHIVED: 10,
};

export function isGenesisTerminalJobStatus(status: GenesisJobStatus): boolean {
  return status === "COMPLETE" || status === "FAILED" || status === "CANCELLED" || status === "TIMED_OUT" || status === "ARCHIVED";
}

export function canTransitionGenesisJobStatus(current: GenesisJobStatus, next: GenesisJobStatus): boolean {
  if (current === next) {
    return true;
  }

  if (isGenesisTerminalJobStatus(current)) {
    return false;
  }

  if (next === "FAILED" || next === "CANCELLED" || next === "TIMED_OUT") {
    return true;
  }

  if (next === "COMPLETE" || next === "ARCHIVED") {
    return true;
  }

  return genesisJobStatusOrder[next] >= genesisJobStatusOrder[current];
}

export type GenesisJobSnapshot = {
  status: GenesisJobStatus;
  progressPercent: number;
  currentStage: string;
  currentWorkflowStep: string;
  estimatedRemainingText?: string;
  timeline: ReturnType<typeof createGenesisTimelineFromEvents>;
};

export function createGenesisJobSnapshot<TJob extends GenesisJob>(job: TJob, now = new Date()): GenesisJobSnapshot {
  const timeline = createGenesisTimelineFromEvents(job.events);
  const progressPercent = isGenesisTerminalJobStatus(job.status)
    ? 100
    : Math.max(0, Math.min(95, genesisJobStatusOrder[job.status] * 12));
  const currentStage = job.status.split("_").join(" ").toLowerCase();
  const currentWorkflowStep = job.type.split("_").join(" ").toLowerCase();
  const estimatedRemainingText = job.startedAt
    ? formatRemainingTime(now.getTime() - new Date(job.startedAt).getTime(), progressPercent)
    : undefined;

  return {
    status: job.status,
    progressPercent,
    currentStage,
    currentWorkflowStep,
    estimatedRemainingText,
    timeline,
  };
}

function formatRemainingTime(elapsedMs: number, progressPercent: number): string | undefined {
  if (progressPercent <= 0 || elapsedMs <= 0) {
    return undefined;
  }

  const remainingRatio = Math.max(0, (100 - progressPercent) / Math.max(progressPercent, 1));
  const remainingMs = Math.round(elapsedMs * remainingRatio);

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return undefined;
  }

  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `${totalMinutes} min remaining`;
}
