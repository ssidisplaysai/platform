import { handleReviewFinanceRecommendation } from "@/lib/gba/finance-api";

export async function POST(request: Request): Promise<Response> {
  return handleReviewFinanceRecommendation(request);
}
