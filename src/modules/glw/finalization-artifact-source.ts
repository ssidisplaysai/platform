import type { GlwGeneratedDraftArtifact, GlwPageExecutionRecord } from "./page-execution";

type FinalizationArtifactSourceField =
  | "generatedDraft"
  | "canonicalizedGeneratedDraft";

export function resolveFinalizationArtifactSource(input: {
  job: Pick<
    GlwPageExecutionRecord,
    "generatedDraft" | "rawGeneratedDraft" | "canonicalizedGeneratedDraft"
  >;
  recoverableFailure: boolean;
}): {
  rawGeneratedDraft: GlwGeneratedDraftArtifact;
  artifactForPipeline: GlwGeneratedDraftArtifact;
  sourceField: FinalizationArtifactSourceField;
} {
  if (!input.job.generatedDraft) {
    throw new Error("GENERATED_DRAFT_MISSING");
  }

  // Recoverable continuation must finalize from the current persisted draft, not stale pre-canonicalized snapshots.
  if (input.recoverableFailure) {
    return {
      rawGeneratedDraft: input.job.generatedDraft,
      artifactForPipeline: input.job.generatedDraft,
      sourceField: "generatedDraft",
    };
  }

  if (input.job.canonicalizedGeneratedDraft) {
    return {
      rawGeneratedDraft: input.job.rawGeneratedDraft ?? input.job.generatedDraft,
      artifactForPipeline: input.job.canonicalizedGeneratedDraft,
      sourceField: "canonicalizedGeneratedDraft",
    };
  }

  return {
    rawGeneratedDraft: input.job.rawGeneratedDraft ?? input.job.generatedDraft,
    artifactForPipeline: input.job.generatedDraft,
    sourceField: "generatedDraft",
  };
}
