import { handleReviewSalesRecommendation } from "@/lib/gba/sales-api";

export async function POST(request: Request) {
  return handleReviewSalesRecommendation(request);
}
