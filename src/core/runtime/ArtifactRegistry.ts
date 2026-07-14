/**
 * ArtifactRegistry.ts
 *
 * Immutable artifact registry tracking every artifact produced during a run.
 *
 * Registry entries become immutable on registration. Verification and
 * certification state are updated by producing new frozen entries.
 * Snapshots are immutable and safe to pass across module boundaries.
 */

import type { CompilerPassId } from "../apollo/CompilerPass.js";

/**
 * Verification state of a registered artifact.
 */
export type ArtifactVerificationState = "pending" | "passed" | "failed" | "skipped";

/**
 * Certification state of a registered artifact.
 */
export type ArtifactCertificationState = "pending" | "certified" | "rejected" | "skipped";

/**
 * Immutable artifact entry.
 */
export interface ArtifactEntry {
  readonly artifactId: string;
  readonly type: string;
  readonly producerPassId: CompilerPassId;
  readonly checksum: string;
  readonly version: string;
  readonly dependencies: readonly string[];
  readonly generationTime: number;
  readonly verificationState: ArtifactVerificationState;
  readonly certificationState: ArtifactCertificationState;
  readonly size: number;
  readonly path: string;
}

/**
 * Immutable snapshot of the entire registry at a point in time.
 */
export interface ArtifactRegistrySnapshot {
  readonly artifacts: readonly ArtifactEntry[];
  readonly count: number;
  readonly snapshotTime: number;
}

/**
 * Artifact registry interface.
 */
export interface ArtifactRegistry {
  /**
   * Register a new artifact.
   * @throws if artifactId is already registered.
   */
  readonly register: (
    entry: Omit<ArtifactEntry, "verificationState" | "certificationState">,
  ) => void;

  /**
   * Update verification state of a registered artifact.
   * @throws if artifactId is not found.
   */
  readonly setVerificationState: (
    artifactId: string,
    state: ArtifactVerificationState,
  ) => void;

  /**
   * Update certification state of a registered artifact.
   * @throws if artifactId is not found.
   */
  readonly setCertificationState: (
    artifactId: string,
    state: ArtifactCertificationState,
  ) => void;

  /** Look up a single artifact. Returns undefined if not found. */
  readonly get: (artifactId: string) => ArtifactEntry | undefined;

  /** All artifacts produced by a specific pass. */
  readonly byPass: (passId: CompilerPassId) => readonly ArtifactEntry[];

  /** Return an immutable snapshot of the current registry state. */
  readonly snapshot: () => ArtifactRegistrySnapshot;

  /** Current number of registered artifacts. */
  readonly count: () => number;
}

/**
 * Create a new ArtifactRegistry instance.
 */
export const createArtifactRegistry = (): ArtifactRegistry => {
  const store = new Map<string, ArtifactEntry>();

  const register = (
    entry: Omit<ArtifactEntry, "verificationState" | "certificationState">,
  ): void => {
    if (store.has(entry.artifactId)) {
      throw new Error(`Artifact already registered: ${entry.artifactId}`);
    }
    store.set(
      entry.artifactId,
      Object.freeze({ ...entry, verificationState: "pending", certificationState: "pending" }),
    );
  };

  const setVerificationState = (
    artifactId: string,
    state: ArtifactVerificationState,
  ): void => {
    const existing = store.get(artifactId);
    if (!existing) throw new Error(`Artifact not found: ${artifactId}`);
    store.set(artifactId, Object.freeze({ ...existing, verificationState: state }));
  };

  const setCertificationState = (
    artifactId: string,
    state: ArtifactCertificationState,
  ): void => {
    const existing = store.get(artifactId);
    if (!existing) throw new Error(`Artifact not found: ${artifactId}`);
    store.set(artifactId, Object.freeze({ ...existing, certificationState: state }));
  };

  const get = (artifactId: string): ArtifactEntry | undefined => store.get(artifactId);

  const byPass = (passId: CompilerPassId): readonly ArtifactEntry[] =>
    Object.freeze([...store.values()].filter((a) => a.producerPassId === passId));

  const snapshot = (): ArtifactRegistrySnapshot =>
    Object.freeze({
      artifacts: Object.freeze([...store.values()]),
      count: store.size,
      snapshotTime: Date.now(),
    });

  const count = (): number => store.size;

  return Object.freeze({
    register,
    setVerificationState,
    setCertificationState,
    get,
    byPass,
    snapshot,
    count,
  });
};
