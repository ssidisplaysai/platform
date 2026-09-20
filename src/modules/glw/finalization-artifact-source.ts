import type { GlwGeneratedDraftArtifact, GlwPageExecutionRecord } from "./page-execution";

type FinalizationArtifactSourceField =
  | "generatedDraft"
  | "canonicalizedGeneratedDraft";

function hasUsableArtifactContent(artifact: GlwGeneratedDraftArtifact | null | undefined): artifact is GlwGeneratedDraftArtifact {
  return Boolean(artifact?.contentHtml?.trim());
}

export function resolveFinalizationArtifactSource(input: {
  job: Pick<
    GlwPageExecutionRecord,
    "status" | "errorCode" | "generatedDraft" | "rawGeneratedDraft" | "canonicalizedGeneratedDraft"
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

  // Recoverable QA failures should resume from the preserved canonicalized artifact when available.
  if (input.recoverableFailure) {
    if (
      input.job.status === "FAILED"
      && input.job.errorCode === "GENERATED_CONTENT_QA_FAILED"
      && hasUsableArtifactContent(input.job.canonicalizedGeneratedDraft)
    ) {
      return {
        rawGeneratedDraft: input.job.rawGeneratedDraft ?? input.job.generatedDraft,
        artifactForPipeline: input.job.canonicalizedGeneratedDraft,
        sourceField: "canonicalizedGeneratedDraft",
      };
    }

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
