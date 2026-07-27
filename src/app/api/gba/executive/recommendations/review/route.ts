import { handleReviewExecutiveRecommendation } from "@/lib/gba/executive-api";

export async function POST(request: Request) {
  return handleReviewExecutiveRecommendation(request);
}
