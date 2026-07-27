import { handleReviewMarketingRecommendation } from "@/lib/gba/marketing-api";

export async function POST(request: Request) {
  return handleReviewMarketingRecommendation(request);
}
