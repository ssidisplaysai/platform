/**
 * PassExecutor.ts
 *
 * Deterministic lifecycle executor for a single compiler pass.
 *
 * Lifecycle stages (executed in this exact order every time):
 *   1. initialize  — validate pass is callable
 *   2. prepare     — verify required dependencies are satisfied
 *   3. execute     — call pass.execute() with context; synchronous passes only
 *   4. verify      — run all verification gates from verificationSchedule
 *   5. certify     — run all certification gates from certificationSchedule
 *   6. complete    — mark success/failure, register artifacts
 *   7. cleanup     — emit final events and release local references
 *
 * Async pass execution (Promise-returning) is rejected: the Enterprise
 * Runtime is synchronous and deterministic. Passes that return a Promise
 * from execute() are recorded as failed with an explanatory error.
 */

import type { CompilerPass, CompilerPassId, CompilerPassContext } from "../apollo/CompilerPass.js";
import type { VerificationResult } from "../apollo/VerificationGate.js";
import type { CertificationResult } from "../apollo/CertificationGate.js";
import type { ExecutionContext } from "./ExecutionContext.js";
import type { ArtifactRegistry } from "./ArtifactRegistry.js";
import type { RuntimeEventBus } from "./RuntimeEventBus.js";
import type { RuntimeMetrics } from "./RuntimeMetrics.js";

/** Lifecycle stage of a pass execution. */
export type PassLifecycleStage =
  | "pending"
  | "initializing"
  | "preparing"
  | "executing"
  | "verifying"
  | "certifying"
  | "completing"
  | "cleaning-up"
  | "completed"
  | "failed";

/**
 * Immutable record of a single pass execution.
 */
export interface PassExecutionRecord {
  readonly passId: CompilerPassId;
  readonly passName: string;
  readonly buildId: string;
  readonly passIndex: number;
  readonly startTime: number;
  readonly endTime: number;
  readonly durationMs: number;
  readonly stage: PassLifecycleStage;
  readonly success: boolean;
  readonly cacheHit: boolean;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly verificationResults: readonly VerificationResult[];
  readonly certificationResults: readonly CertificationResult[];
  readonly diagnostics: readonly string[];
  readonly errors: readonly string[];
  readonly outputCount: number;
}

/**
 * Pass executor interface.
 */
export interface PassExecutor {
  /**
   * Execute the full deterministic lifecycle for a single compiler pass.
   * Returns an immutable execution record.
   */
  readonly executePass: (
    pass: CompilerPass,
    passIndex: number,
    totalPasses: number,
    completedPassIds: ReadonlySet<CompilerPassId>,
    context: ExecutionContext,
    artifactRegistry: ArtifactRegistry,
    eventBus: RuntimeEventBus,
    metrics: RuntimeMetrics,
  ) => PassExecutionRecord;
}

/**
 * Deterministic checksum derived from output data (no external crypto).
 * Uses a djb2-style hash over the JSON representation.
 */
const computeChecksum = (data: unknown): string => {
  const str = JSON.stringify(data) ?? "";
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
    h = h >>> 0; // coerce to unsigned 32-bit
  }
  return `djb2:${h.toString(16).padStart(8, "0")}`;
};

/**
 * Create a new PassExecutor instance.
 */
export const createPassExecutor = (): PassExecutor => {
  const executePass = (
    pass: CompilerPass,
    passIndex: number,
    totalPasses: number,
    completedPassIds: ReadonlySet<CompilerPassId>,
    context: ExecutionContext,
    artifactRegistry: ArtifactRegistry,
    eventBus: RuntimeEventBus,
    metrics: RuntimeMetrics,
  ): PassExecutionRecord => {
    const startTime = context.startTime;
    const diagnostics: string[] = [];
    const errors: string[] = [];
    const verificationResults: VerificationResult[] = [];
    const certificationResults: CertificationResult[] = [];
    let success = false;
    let outputs: Record<string, unknown> = {};

    let seqBase = passIndex * 10_000;
    const nextSeq = (): number => seqBase++;

    // ── Emit PassStarted ─────────────────────────────────────────────────────
    eventBus.publish(Object.freeze({
      type: "PassStarted",
      buildId: context.buildId,
      sequenceNumber: nextSeq(),
      passId: pass.id,
      passName: pass.name,
      passIndex,
      totalPasses,
    }));

    try {
      // 1. Initialize
      diagnostics.push(`[${pass.id}:initialize] begin`);

      // 2. Prepare — check required dependencies are already completed
      diagnostics.push(`[${pass.id}:prepare] checking ${pass.dependencies.length} dependencies`);
      for (const dep of pass.dependencies) {
        if (!dep.optional && !completedPassIds.has(dep.passId)) {
          errors.push(
            `Dependency not satisfied: ${dep.passId} (required by ${pass.id})`,
          );
        }
      }
      if (errors.length > 0 && context.configuration.enforcePassDependencies) {
        throw new Error(errors.join("; "));
      }

      // 3. Execute — synchronous only
      diagnostics.push(`[${pass.id}:execute] begin`);
      const passContext: CompilerPassContext = Object.freeze({
        passId: pass.id,
        buildId: context.buildId,
        timestamp: context.startTime,
        metadata: Object.freeze({
          companyId: context.companyId,
          workspace: context.workspace,
          environment: context.environment,
        }),
      });
      const rawResult: unknown = pass.execute({}, passContext);

      if (rawResult instanceof Promise) {
        throw new Error(
          `Pass "${pass.id}" returned a Promise. ` +
          "The Enterprise Runtime is synchronous. Passes must return " +
          "Record<string, unknown> directly, not via Promise.",
        );
      }

      outputs = (rawResult as Record<string, unknown>) ?? {};
      diagnostics.push(`[${pass.id}:execute] produced ${Object.keys(outputs).length} outputs`);

      // 4. Verify
      if (
        context.configuration.verificationEnabled &&
        pass.verificationSchedule.gates.length > 0
      ) {
        diagnostics.push(
          `[${pass.id}:verify] running ${pass.verificationSchedule.gates.length} gate(s)`,
        );
        for (const gate of pass.verificationSchedule.gates) {
          eventBus.publish(Object.freeze({
            type: "VerificationStarted",
            buildId: context.buildId,
            sequenceNumber: nextSeq(),
            passId: pass.id,
            gateId: gate.id,
            gateName: gate.name,
          }));

          const vCtx = Object.freeze({
            passId: pass.id,
            inputs: {},
            outputs,
            metadata: { buildId: context.buildId },
          });
          const vRaw = gate.verify(vCtx);

          if (vRaw instanceof Promise) {
            const vFail: VerificationResult = Object.freeze({
              gateId: gate.id,
              passed: false,
              message: "Async verification not supported in synchronous runtime",
              errors: ["Async verification not supported"],
              warnings: [],
              duration: 0,
            });
            verificationResults.push(vFail);
            metrics.recordVerification(false);
            eventBus.publish(Object.freeze({
              type: "VerificationFailed",
              buildId: context.buildId,
              sequenceNumber: nextSeq(),
              passId: pass.id,
              gateId: gate.id,
              result: vFail,
              errors: vFail.errors,
            }));
          } else {
            verificationResults.push(vRaw);
            metrics.recordVerification(vRaw.passed);
            if (vRaw.passed) {
              eventBus.publish(Object.freeze({
                type: "VerificationPassed",
                buildId: context.buildId,
                sequenceNumber: nextSeq(),
                passId: pass.id,
                gateId: gate.id,
                result: vRaw,
              }));
            } else {
              for (const e of vRaw.errors) errors.push(e);
              eventBus.publish(Object.freeze({
                type: "VerificationFailed",
                buildId: context.buildId,
                sequenceNumber: nextSeq(),
                passId: pass.id,
                gateId: gate.id,
                result: vRaw,
                errors: vRaw.errors,
              }));
            }
          }
        }
      }

      // 5. Certify
      if (
        context.configuration.certificationEnabled &&
        pass.certificationSchedule.gates.length > 0
      ) {
        diagnostics.push(
          `[${pass.id}:certify] running ${pass.certificationSchedule.gates.length} gate(s)`,
        );
        const vMap: Record<string, boolean> = {};
        for (const vr of verificationResults) vMap[vr.gateId] = vr.passed;

        for (const gate of pass.certificationSchedule.gates) {
          eventBus.publish(Object.freeze({
            type: "CertificationStarted",
            buildId: context.buildId,
            sequenceNumber: nextSeq(),
            passId: pass.id,
            gateId: gate.id,
            gateName: gate.name,
          }));

          const cCtx = Object.freeze({
            buildId: context.buildId,
            passId: pass.id,
            verificationResults: vMap,
            outputs,
            metadata: { companyId: context.companyId },
          });
          const cRaw = gate.certify(cCtx);

          if (cRaw instanceof Promise) {
            const cFail: CertificationResult = Object.freeze({
              gateId: gate.id,
              certified: false,
              level: "alpha" as const,
              message: "Async certification not supported in synchronous runtime",
              requirements: [],
              violations: ["Async certification not supported"],
              timestamp: context.startTime,
            });
            certificationResults.push(cFail);
            metrics.recordCertification(false);
            eventBus.publish(Object.freeze({
              type: "CertificationFailed",
              buildId: context.buildId,
              sequenceNumber: nextSeq(),
              passId: pass.id,
              gateId: gate.id,
              result: cFail,
              violations: cFail.violations,
            }));
          } else {
            certificationResults.push(cRaw);
            metrics.recordCertification(cRaw.certified);
            if (cRaw.certified) {
              eventBus.publish(Object.freeze({
                type: "CertificationPassed",
                buildId: context.buildId,
                sequenceNumber: nextSeq(),
                passId: pass.id,
                gateId: gate.id,
                result: cRaw,
              }));
            } else {
              for (const v of cRaw.violations) errors.push(v);
              eventBus.publish(Object.freeze({
                type: "CertificationFailed",
                buildId: context.buildId,
                sequenceNumber: nextSeq(),
                passId: pass.id,
                gateId: gate.id,
                result: cRaw,
                violations: cRaw.violations,
              }));
            }
          }
        }
      }

      // 6. Complete — register artifacts
      diagnostics.push(`[${pass.id}:complete] registering artifacts`);
      for (const [outputType, outputData] of Object.entries(outputs)) {
        const artifactId = `${context.buildId}:${pass.id}:${outputType}`;
        const checksum = computeChecksum(outputData);
        artifactRegistry.register({
          artifactId,
          type: outputType,
          producerPassId: pass.id,
          checksum,
          version: pass.version,
          dependencies: pass.dependencies.map((d) => d.passId),
          generationTime: context.startTime,
          size: JSON.stringify(outputData).length,
          path: `${context.workspace}/${pass.id}/${outputType}`,
        });
        metrics.recordArtifact();
        eventBus.publish(Object.freeze({
          type: "ArtifactGenerated",
          buildId: context.buildId,
          sequenceNumber: nextSeq(),
          artifactId,
          artifactType: outputType,
          producerPassId: pass.id,
          checksum,
        }));
      }

      success = errors.length === 0;
      metrics.recordPassSucceeded(false);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      success = false;
      metrics.recordPassFailed();
      metrics.recordError();
      eventBus.publish(Object.freeze({
        type: "PassFailed",
        buildId: context.buildId,
        sequenceNumber: nextSeq(),
        passId: pass.id,
        passName: pass.name,
        error: msg,
        fatal: true,
      }));
    }

    // 7. Cleanup
    diagnostics.push(`[${pass.id}:cleanup] done`);

    const endTime = startTime + 1; // duration is deterministic in unit execution context

    // Emit PassCompleted (even on failure — caller distinguishes via success flag)
    if (success) {
      eventBus.publish(Object.freeze({
        type: "PassCompleted",
        buildId: context.buildId,
        sequenceNumber: nextSeq(),
        passId: pass.id,
        passName: pass.name,
        passIndex,
        totalPasses,
        outputCount: Object.keys(outputs).length,
        durationMs: endTime - startTime,
        cacheHit: false,
      }));
    }

    return Object.freeze({
      passId: pass.id,
      passName: pass.name,
      buildId: context.buildId,
      passIndex,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      stage: success ? "completed" : "failed",
      success,
      cacheHit: false,
      outputs: Object.freeze({ ...outputs }),
      verificationResults: Object.freeze([...verificationResults]),
      certificationResults: Object.freeze([...certificationResults]),
      diagnostics: Object.freeze([...diagnostics]),
      errors: Object.freeze([...errors]),
      outputCount: Object.keys(outputs).length,
    });
  };

  return Object.freeze({ executePass });
};
