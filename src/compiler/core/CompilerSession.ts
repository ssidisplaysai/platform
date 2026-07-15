import { SourceHash } from "../provenance/SourceHash";
import type { CompilerSessionState } from "./types";

export interface CompilerSessionMetadata {
  startedAt: string;
  endedAt?: string;
  replayOfSessionId?: string;
  restartOfSessionId?: string;
}

export class CompilerSession {
  readonly id: string;
  private state: CompilerSessionState = "initialized";
  private readonly metadata: CompilerSessionMetadata;

  constructor(sessionId?: string, startedAt: string = new Date().toISOString()) {
    this.id = sessionId ?? SourceHash.sha256(`compiler-session:${startedAt}`).slice(0, 24);
    this.metadata = {
      startedAt,
    };
  }

  currentState(): CompilerSessionState {
    return this.state;
  }

  getMetadata(): CompilerSessionMetadata {
    return { ...this.metadata };
  }

  start(): void {
    if (this.state !== "initialized") {
      throw new Error(`Cannot start session from state: ${this.state}`);
    }

    this.state = "running";
  }

  complete(completedAt: string = new Date().toISOString()): void {
    if (this.state !== "running") {
      throw new Error(`Cannot complete session from state: ${this.state}`);
    }

    this.state = "completed";
    this.metadata.endedAt = completedAt;
  }

  fail(failedAt: string = new Date().toISOString()): void {
    if (this.state !== "running") {
      throw new Error(`Cannot fail session from state: ${this.state}`);
    }

    this.state = "failed";
    this.metadata.endedAt = failedAt;
  }

  terminate(terminatedAt: string = new Date().toISOString()): void {
    if (this.state === "terminated") {
      return;
    }

    this.state = "terminated";
    this.metadata.endedAt = terminatedAt;
  }

  cancel(cancelledAt: string = new Date().toISOString()): void {
    if (this.state !== "running") {
      throw new Error(`Cannot cancel session from state: ${this.state}`);
    }

    this.state = "cancelled";
    this.metadata.endedAt = cancelledAt;
  }

  restart(newSessionId?: string, startedAt: string = new Date().toISOString()): CompilerSession {
    const restarted = new CompilerSession(newSessionId, startedAt);
    restarted.metadata.restartOfSessionId = this.id;
    return restarted;
  }

  replay(newSessionId?: string, startedAt: string = new Date().toISOString()): CompilerSession {
    const replayed = new CompilerSession(newSessionId, startedAt);
    replayed.metadata.replayOfSessionId = this.id;
    return replayed;
  }
}
