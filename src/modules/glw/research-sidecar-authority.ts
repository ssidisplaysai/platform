export const GLW_RESEARCH_SIDECAR_WORKFLOW_ID =
  "E3ZgpwAu98DwpUzO";

export const GLW_RESEARCH_SIDECAR_CONFIRMATION =
  "EXECUTE_COLORADO_RESEARCH_CANARY";

export const GLW_RESEARCH_SIDECAR_COLORADO = {
  stateCode: "CO",
  canonicalPath:
    "/indoor-digital-sphere/colorado/",
  jobId:
    "ecd5e8b9-a177-4ed9-aef7-873fa7ee3e29",
  wordpressObjectId: "19853",
} as const;

export type GlwResearchSidecarRequest = {
  organizationId: string;
  siteId: string;
  campaignId: string;
  productId: string;
  stateCode: string;
  canonicalPath: string;
  jobId: string;
  wordpressObjectId: string;
};

const requestKeys = [
  "campaignId",
  "canonicalPath",
  "jobId",
  "organizationId",
  "productId",
  "siteId",
  "stateCode",
  "wordpressObjectId",
];

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();

  return (
    actual.length === sortedExpected.length
    && actual.every(
      (key, index) =>
        key === sortedExpected[index],
    )
  );
}

export function validateGlwResearchSidecarInput(
  value: unknown,
): GlwResearchSidecarRequest {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    throw new Error(
      "GLW research sidecar request is malformed.",
    );
  }

  const envelope =
    value as Record<string, unknown>;

  if (
    !hasExactKeys(
      envelope,
      ["confirm", "request"],
    )
    || envelope.confirm
      !== GLW_RESEARCH_SIDECAR_CONFIRMATION
    || !envelope.request
    || typeof envelope.request !== "object"
    || Array.isArray(envelope.request)
  ) {
    throw new Error(
      "Exact Colorado research canary confirmation and request are required.",
    );
  }

  const request =
    envelope.request as Record<string, unknown>;

  if (
    !hasExactKeys(request, requestKeys)
    || requestKeys.some(
      (key) =>
        typeof request[key] !== "string"
        || !String(request[key]).trim(),
    )
  ) {
    throw new Error(
      "GLW research execution identity is malformed.",
    );
  }

  if (
    request.stateCode
      !== GLW_RESEARCH_SIDECAR_COLORADO.stateCode
    || request.canonicalPath
      !== GLW_RESEARCH_SIDECAR_COLORADO.canonicalPath
    || request.jobId
      !== GLW_RESEARCH_SIDECAR_COLORADO.jobId
    || request.wordpressObjectId
      !== GLW_RESEARCH_SIDECAR_COLORADO.wordpressObjectId
  ) {
    throw new Error(
      "GLW research sidecar is authorized only for the exact Colorado canary identity.",
    );
  }

  return request as GlwResearchSidecarRequest;
}
