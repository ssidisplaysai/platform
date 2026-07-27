import { handleReviewOperationsRecommendation } from "@/lib/gba/operations-api";

export async function POST(request: Request) {
  return handleReviewOperationsRecommendation(request);
}
