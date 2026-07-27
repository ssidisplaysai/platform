import { handleCustomerSuccessRecommendations } from "@/lib/gba/customer-success-api";

export async function GET(request: Request): Promise<Response> {
  return handleCustomerSuccessRecommendations(request);
}
