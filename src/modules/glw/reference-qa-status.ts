const GLW_REFERENCE_QA_SUCCESS_STATUSES = new Set(["COMPLETE", "PASSED"]);

export function isGlwReferenceQaSuccess(qaStatus: string | null | undefined): boolean {
  const normalized = (qaStatus ?? "").trim().toUpperCase();
  return GLW_REFERENCE_QA_SUCCESS_STATUSES.has(normalized);
}
