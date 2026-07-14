/**
 * RuntimeEvents.ts
 *
 * Strongly-typed runtime event model.
 *
 * All events are immutable value objects. The discriminated union
 * AnyRuntimeEvent covers every event the runtime can emit.
 *
 * Events are emitted in deterministic sequence-number order.
 */

import type { CompilerPassId } from "../apollo/CompilerPass.js";
import type { VerificationResult } from "../apollo/VerificationGate.js";
import type { CertificationResult } from "../apollo/CertificationGate.js";
import type { RuntimeStatus } from "./RuntimeStatus.js";

// ─── Event type names ─────────────────────────────────────────────────────────

export type RuntimeEventType =
  | "RuntimeStarted"
  | "PassStarted"
  | "PassCompleted"
  | "PassFailed"
  | "ArtifactGenerated"
  | "VerificationStarted"
  | "VerificationPassed"
  | "VerificationFailed"
  | "CertificationStarted"
  | "CertificationPassed"
  | "CertificationFailed"
  | "RuntimeCompleted"
  | "RuntimeFailed"
  | "RuntimeCancelled"
  | "StatusChanged";

// ─── Base event ───────────────────────────────────────────────────────────────

/** All runtime events share these fields. */
export interface RuntimeEvent {
  readonly type: RuntimeEventType;
  readonly buildId: string;
  /** Monotonically increasing counter; unique per run. */
  readonly sequenceNumber: number;
}

// ─── Lifecycle events ─────────────────────────────────────────────────────────

export interface RuntimeStartedEvent extends RuntimeEvent {
  readonly type: "RuntimeStarted";
  readonly companyId: string;
  readonly runtimeVersion: string;
  readonly passCount: number;
}

export interface RuntimeCompletedEvent extends RuntimeEvent {
  readonly type: "RuntimeCompleted";
  readonly totalPasses: number;
  readonly totalArtifacts: number;
  readonly totalDurationMs: number;
  readonly verificationsPassed: boolean;
  readonly certificationsPassed: boolean;
}

export interface RuntimeFailedEvent extends RuntimeEvent {
  readonly type: "RuntimeFailed";
  readonly error: string;
  readonly failedPassId: CompilerPassId | undefined;
  readonly passesCompleted: number;
}

export interface RuntimeCancelledEvent extends RuntimeEvent {
  readonly type: "RuntimeCancelled";
  readonly passesCompleted: number;
  readonly reason: string;
}

export interface StatusChangedEvent extends RuntimeEvent {
  readonly type: "StatusChanged";
  readonly from: RuntimeStatus;
  readonly to: RuntimeStatus;
}

// ─── Pass events ──────────────────────────────────────────────────────────────

export interface PassStartedEvent extends RuntimeEvent {
  readonly type: "PassStarted";
  readonly passId: CompilerPassId;
  readonly passName: string;
  readonly passIndex: number;
  readonly totalPasses: number;
}

export interface PassCompletedEvent extends RuntimeEvent {
  readonly type: "PassCompleted";
  readonly passId: CompilerPassId;
  readonly passName: string;
  readonly passIndex: number;
  readonly totalPasses: number;
  readonly outputCount: number;
  readonly durationMs: number;
  readonly cacheHit: boolean;
}

export interface PassFailedEvent extends RuntimeEvent {
  readonly type: "PassFailed";
  readonly passId: CompilerPassId;
  readonly passName: string;
  readonly error: string;
  readonly fatal: boolean;
}

// ─── Artifact events ──────────────────────────────────────────────────────────

export interface ArtifactGeneratedEvent extends RuntimeEvent {
  readonly type: "ArtifactGenerated";
  readonly artifactId: string;
  readonly artifactType: string;
  readonly producerPassId: CompilerPassId;
  readonly checksum: string;
}

// ─── Verification events ──────────────────────────────────────────────────────

export interface VerificationStartedEvent extends RuntimeEvent {
  readonly type: "VerificationStarted";
  readonly passId: CompilerPassId;
  readonly gateId: string;
  readonly gateName: string;
}

export interface VerificationPassedEvent extends RuntimeEvent {
  readonly type: "VerificationPassed";
  readonly passId: CompilerPassId;
  readonly gateId: string;
  readonly result: VerificationResult;
}

export interface VerificationFailedEvent extends RuntimeEvent {
  readonly type: "VerificationFailed";
  readonly passId: CompilerPassId;
  readonly gateId: string;
  readonly result: VerificationResult;
  readonly errors: readonly string[];
}

// ─── Certification events ─────────────────────────────────────────────────────

export interface CertificationStartedEvent extends RuntimeEvent {
  readonly type: "CertificationStarted";
  readonly passId: CompilerPassId;
  readonly gateId: string;
  readonly gateName: string;
}

export interface CertificationPassedEvent extends RuntimeEvent {
  readonly type: "CertificationPassed";
  readonly passId: CompilerPassId;
  readonly gateId: string;
  readonly result: CertificationResult;
}

export interface CertificationFailedEvent extends RuntimeEvent {
  readonly type: "CertificationFailed";
  readonly passId: CompilerPassId;
  readonly gateId: string;
  readonly result: CertificationResult;
  readonly violations: readonly string[];
}

// ─── Discriminated union ──────────────────────────────────────────────────────

/** Discriminated union of every event the Enterprise Runtime can emit. */
export type AnyRuntimeEvent =
  | RuntimeStartedEvent
  | RuntimeCompletedEvent
  | RuntimeFailedEvent
  | RuntimeCancelledEvent
  | StatusChangedEvent
  | PassStartedEvent
  | PassCompletedEvent
  | PassFailedEvent
  | ArtifactGeneratedEvent
  | VerificationStartedEvent
  | VerificationPassedEvent
  | VerificationFailedEvent
  | CertificationStartedEvent
  | CertificationPassedEvent
  | CertificationFailedEvent;
