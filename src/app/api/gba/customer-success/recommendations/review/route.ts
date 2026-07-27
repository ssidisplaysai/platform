import { handleReviewCustomerSuccessRecommendation } from "@/lib/gba/customer-success-api";

export async function POST(request: Request): Promise<Response> {
  return handleReviewCustomerSuccessRecommendation(request);
}
