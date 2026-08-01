import { SourceHash } from "../../provenance/SourceHash";
import { stableStringify } from "../../core/stableStringify";
import type {
  CertificationContext,
  CompilerConfiguration,
  CompilerEnvironment,
  CompilerExecutionContext,
  CompilerLifecycle,
  CompilerLifecycleState,
  CompilerRuntimeState,
  CompilerSession,
  CompilerSessionState,
  RuntimeHealth,
  RuntimeManifest,
  StructuredDiagnostic,
  ReplayContext,
} from "./contracts";
import { deepFreeze } from "./immutability";

interface SessionRecord {
  sessionId: string;
  executionId: string;
  purpose: string;
  state: CompilerSessionState;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
}

interface RuntimeHostOptions {
  readonly configuration: CompilerConfiguration;
  readonly environment: CompilerEnvironment;
  readonly clock?: () => string;
}

export class CompilerRuntimeHost {
  private readonly runtimeId: string;
  private readonly configuration: CompilerConfiguration;
  private readonly environment: CompilerEnvironment;
  private readonly diagnostics: StructuredDiagnostic[] = [];
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly lifecycleHistory: Array<{ state: CompilerLifecycleState; at: string; reason: string }> = [];
  private readonly clock: () => string;

  private lifecycleState: CompilerLifecycleState = "DECLARED";
  private nextSessionOrdinal = 0;

  constructor(options: RuntimeHostOptions) {
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.configuration = deepFreeze({
      ...options.configuration,
      features: [...options.configuration.features].sort(),
    });
    this.environment = deepFreeze({ ...options.environment });
    this.runtimeId = this.createRuntimeId();
    this.appendLifecycle("DECLARED", "Runtime host constructed");
    this.recordDiagnostic("info", "RUNTIME_DECLARED", "Runtime host declared");
  }

  initialize(): void {
    if (this.lifecycleState !== "DECLARED") {
      throw new Error(`Runtime initialization is only valid from DECLARED, received ${this.lifecycleState}`);
    }

    this.lifecycleState = "READY";
    this.appendLifecycle("READY", "Runtime host initialized");
    this.recordDiagnostic("info", "RUNTIME_READY", "Runtime host is ready");
  }

  shutdown(reason = "Graceful shutdown requested"): void {
    if (this.lifecycleState === "ARCHIVED") {
      return;
    }

    for (const session of this.sessions.values()) {
      if (session.state === "CREATED" || session.state === "RUNNING") {
        session.state = "TERMINATED";
        session.endedAt = this.clock();
      }
    }

    this.lifecycleState = "ARCHIVED";
    this.appendLifecycle("ARCHIVED", reason);
    this.recordDiagnostic("info", "RUNTIME_ARCHIVED", reason);
  }

  createSession(purpose: string): CompilerSession {
    if (this.lifecycleState !== "READY") {
      throw new Error(`Cannot create session while runtime state is ${this.lifecycleState}`);
    }

    this.nextSessionOrdinal += 1;
    const createdAt = this.clock();
    const sessionId = this.deterministicId("session", `${this.nextSessionOrdinal}:${purpose}:${createdAt}`);
    const executionId = this.deterministicId("execution", `${sessionId}:${purpose}`);

    const session: SessionRecord = {
      sessionId,
      executionId,
      purpose,
      state: "CREATED",
      createdAt,
    };

    this.sessions.set(sessionId, session);
    this.lifecycleState = "EXECUTING";
    this.appendLifecycle("EXECUTING", `Session created: ${sessionId}`);
    this.recordDiagnostic("info", "SESSION_CREATED", `Compiler session created: ${sessionId}`, { sessionId, executionId, purpose });

    return deepFreeze(this.toCompilerSession(session));
  }

  startSession(sessionId: string): CompilerSession {
    const session = this.requireSession(sessionId);
    if (session.state !== "CREATED") {
      throw new Error(`Session ${sessionId} cannot start from state ${session.state}`);
    }

    session.state = "RUNNING";
    session.startedAt = this.clock();
    this.recordDiagnostic("info", "SESSION_STARTED", `Compiler session started: ${sessionId}`, { sessionId });

    return deepFreeze(this.toCompilerSession(session));
  }

  completeSession(sessionId: string): CompilerSession {
    const session = this.requireSession(sessionId);
    if (session.state !== "RUNNING") {
      throw new Error(`Session ${sessionId} cannot complete from state ${session.state}`);
    }

    session.state = "COMPLETED";
    session.endedAt = this.clock();
    this.recordDiagnostic("info", "SESSION_COMPLETED", `Compiler session completed: ${sessionId}`, { sessionId });
    this.reconcileLifecycleAfterSessionMutation();

    return deepFreeze(this.toCompilerSession(session));
  }

  failSession(sessionId: string, message: string): CompilerSession {
    const session = this.requireSession(sessionId);
    if (session.state === "COMPLETED" || session.state === "TERMINATED") {
      throw new Error(`Session ${sessionId} cannot fail from state ${session.state}`);
    }

    session.state = "FAILED";
    session.endedAt = this.clock();
    this.recordDiagnostic("error", "SESSION_FAILED", message, { sessionId });
    this.lifecycleState = "FAILED";
    this.appendLifecycle("FAILED", `Session failed: ${sessionId}`);

    return deepFreeze(this.toCompilerSession(session));
  }

  terminateSession(sessionId: string, reason = "Session terminated by runtime"): CompilerSession {
    const session = this.requireSession(sessionId);
    if (session.state === "TERMINATED") {
      return deepFreeze(this.toCompilerSession(session));
    }

    session.state = "TERMINATED";
    session.endedAt = this.clock();
    this.recordDiagnostic("warning", "SESSION_TERMINATED", reason, { sessionId });
    this.reconcileLifecycleAfterSessionMutation();

    return deepFreeze(this.toCompilerSession(session));
  }

  createExecutionContext(sessionId: string): CompilerExecutionContext {
    const session = this.requireSession(sessionId);
    const manifest = this.bootstrapRuntimeManifest(session.sessionId);
    const replay = this.bootstrapReplayContext(session.sessionId, manifest.manifestId);
    const certification = this.bootstrapCertificationContext(session.sessionId, []);

    const context: CompilerExecutionContext = {
      contextId: this.deterministicId("context", `${session.executionId}:${manifest.manifestId}`),
      runtimeId: this.runtimeId,
      sessionId: session.sessionId,
      executionId: session.executionId,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      lifecycleState: this.lifecycleState,
      environment: this.environment,
      configuration: this.configuration,
      manifest,
      replay,
      certification,
      createdAt: this.clock(),
    };

    this.recordDiagnostic("info", "EXECUTION_CONTEXT_CREATED", `Execution context created for session ${sessionId}`, {
      sessionId,
      executionId: session.executionId,
      contextId: context.contextId,
    });

    return deepFreeze(context);
  }

  bootstrapRuntimeManifest(sessionId: string): RuntimeManifest {
    const session = this.requireSession(sessionId);
    const createdAt = this.clock();
    const payload = {
      runtimeId: this.runtimeId,
      sessionId,
      executionId: session.executionId,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      lifecycleState: this.lifecycleState,
      createdAt,
    };

    const checksum = SourceHash.sha256(stableStringify(payload));

    const manifest: RuntimeManifest = {
      manifestId: this.deterministicId("manifest", `${session.executionId}:${checksum}`),
      ...payload,
      checksum,
    };

    return deepFreeze(manifest);
  }

  bootstrapReplayContext(sessionId: string, sourceManifestId: string): ReplayContext {
    const session = this.requireSession(sessionId);
    const createdAt = this.clock();
    const deterministicFingerprint = SourceHash.sha256(
      stableStringify({
        runtimeId: this.runtimeId,
        executionId: session.executionId,
        compilerVersion: this.configuration.compilerVersion,
        specificationVersion: this.configuration.specificationVersion,
        sourceManifestId,
      }),
    );

    const replay: ReplayContext = {
      replayId: this.deterministicId("replay", `${session.executionId}:${deterministicFingerprint}`),
      runtimeId: this.runtimeId,
      sessionId,
      executionId: session.executionId,
      sourceManifestId,
      deterministicFingerprint,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      createdAt,
    };

    return deepFreeze(replay);
  }

  bootstrapCertificationContext(sessionId: string, evidenceReferences: readonly string[]): CertificationContext {
    const session = this.requireSession(sessionId);
    const sortedEvidence = [...evidenceReferences].sort();
    const createdAt = this.clock();
    const readiness = sortedEvidence.length > 0 ? "READY" : "PENDING";

    const certification: CertificationContext = {
      certificationId: this.deterministicId(
        "certification",
        `${session.executionId}:${this.configuration.specificationVersion}:${sortedEvidence.join(",")}`,
      ),
      runtimeId: this.runtimeId,
      sessionId,
      executionId: session.executionId,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      evidenceReferences: sortedEvidence,
      readiness,
      createdAt,
    };

    return deepFreeze(certification);
  }

  getRuntimeState(): CompilerRuntimeState {
    return deepFreeze({
      runtimeId: this.runtimeId,
      lifecycle: this.getLifecycle(),
      configuration: this.configuration,
      environment: this.environment,
      activeSessions: this.collectSessions((session) => session.state === "CREATED" || session.state === "RUNNING"),
      completedSessions: this.collectSessions(
        (session) =>
          session.state === "COMPLETED" || session.state === "FAILED" || session.state === "TERMINATED",
      ),
      diagnostics: this.diagnostics.map((entry) => deepFreeze({ ...entry })),
      health: this.getHealth(),
    });
  }

  getLifecycle(): CompilerLifecycle {
    return deepFreeze({
      currentState: this.lifecycleState,
      history: this.lifecycleHistory.map((entry) => deepFreeze({ ...entry })),
    });
  }

  getHealth(): RuntimeHealth {
    const checks = [
      this.lifecycleState === "FAILED"
        ? { name: "lifecycle-state", status: "fail" as const, detail: "Runtime lifecycle is FAILED" }
        : this.lifecycleState === "ARCHIVED"
          ? { name: "lifecycle-state", status: "warn" as const, detail: "Runtime lifecycle is ARCHIVED" }
          : { name: "lifecycle-state", status: "pass" as const, detail: `Runtime lifecycle is ${this.lifecycleState}` },
      this.sessions.size === 0
        ? { name: "session-activity", status: "warn" as const, detail: "No sessions have been created" }
        : { name: "session-activity", status: "pass" as const, detail: `${this.sessions.size} session(s) tracked` },
      this.configuration.deterministicMode
        ? { name: "deterministic-mode", status: "pass" as const, detail: "Deterministic mode enabled" }
        : { name: "deterministic-mode", status: "fail" as const, detail: "Deterministic mode disabled" },
    ];

    const status = checks.some((check) => check.status === "fail")
      ? "unhealthy"
      : checks.some((check) => check.status === "warn")
        ? "degraded"
        : "healthy";

    return deepFreeze({
      status,
      checkedAt: this.clock(),
      checks,
    });
  }

  private requireSession(sessionId: string): SessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    return session;
  }

  private reconcileLifecycleAfterSessionMutation(): void {
    const active = [...this.sessions.values()].some((session) => session.state === "CREATED" || session.state === "RUNNING");
    if (active) {
      this.lifecycleState = "EXECUTING";
      return;
    }

    if (this.lifecycleState !== "FAILED") {
      this.lifecycleState = "COMPLETED";
      this.appendLifecycle("COMPLETED", "All active sessions resolved");
    }
  }

  private deterministicId(prefix: string, value: string): string {
    const digest = SourceHash.sha256(
      stableStringify({
        runtimeId: this.runtimeId,
        prefix,
        value,
        compilerVersion: this.configuration.compilerVersion,
        specificationVersion: this.configuration.specificationVersion,
      }),
    );
    return `${prefix}-${digest.slice(0, 24)}`;
  }

  private createRuntimeId(): string {
    const digest = SourceHash.sha256(
      stableStringify({
        configuration: this.configuration,
        environment: this.environment,
      }),
    );
    return `runtime-${digest.slice(0, 24)}`;
  }

  private collectSessions(predicate: (session: SessionRecord) => boolean): CompilerSession[] {
    return [...this.sessions.values()]
      .filter(predicate)
      .sort((a, b) => a.sessionId.localeCompare(b.sessionId))
      .map((session) => deepFreeze(this.toCompilerSession(session)));
  }

  private toCompilerSession(session: SessionRecord): CompilerSession {
    return {
      sessionId: session.sessionId,
      executionId: session.executionId,
      purpose: session.purpose,
      state: session.state,
      createdAt: session.createdAt,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    };
  }

  private appendLifecycle(state: CompilerLifecycleState, reason: string): void {
    this.lifecycleHistory.push({
      state,
      at: this.clock(),
      reason,
    });
  }

  private recordDiagnostic(
    severity: "info" | "warning" | "error",
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ): void {
    this.diagnostics.push(
      deepFreeze({
        timestamp: this.clock(),
        severity,
        code,
        message,
        details,
      }),
    );
  }
}
