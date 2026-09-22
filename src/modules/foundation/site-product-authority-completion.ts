export function evaluateProductAuthorityCompletion(input: {
  candidateCount: number;
  approvedCount: number;
  needReview: number;
  protectedBlockers: number;
}): boolean {
  return input.candidateCount > 0 && input.approvedCount > 0 && input.needReview === 0 && input.protectedBlockers === 0;
}
