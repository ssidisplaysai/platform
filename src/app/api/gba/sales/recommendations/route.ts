import { handleSalesRecommendations } from "@/lib/gba/sales-api";

export async function GET(request: Request) {
  return handleSalesRecommendations(request);
}
