import { SourceHash } from "../provenance/SourceHash";
import type { CompilerArtifact, CompilerStatus } from "./types";

export class Compilation<TInput = unknown> {
  readonly id: string;
  readonly input: TInput;
  readonly sessionId: string;
  readonly startedAt: string;
  private status: CompilerStatus = "created";
  private readonly outputs = new Map<string, unknown>();
  private readonly artifacts: CompilerArtifact[] = [];

  constructor(input: TInput, sessionId: string, startedAt: string) {
    this.input = input;
    this.sessionId = sessionId;
    this.startedAt = startedAt;
    this.id = SourceHash.sha256(`${sessionId}:${startedAt}:${JSON.stringify([typeof input])}`).slice(0, 24);
  }

  markRunning(): void {
    this.status = "running";
  }

  markCompleted(): void {
    this.status = "completed";
  }

  markFailed(): void {
    this.status = "failed";
  }

  markCancelled(): void {
    this.status = "cancelled";
  }

  registerOutput(passId: string, output: unknown): void {
    this.outputs.set(passId, output);
  }

  registerArtifact(artifact: CompilerArtifact): void {
    this.artifacts.push(artifact);
  }

  getStatus(): CompilerStatus {
    return this.status;
  }

  snapshotOutputs(): Readonly<Record<string, unknown>> {
    return Object.freeze(Object.fromEntries([...this.outputs.entries()].sort(([left], [right]) => left.localeCompare(right))));
  }

  snapshotArtifacts(): readonly CompilerArtifact[] {
    return [...this.artifacts].sort((left, right) => left.id.localeCompare(right.id));
  }
}