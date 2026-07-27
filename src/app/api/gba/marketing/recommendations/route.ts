import { handleMarketingRecommendations } from "@/lib/gba/marketing-api";

export async function GET(request: Request) {
  return handleMarketingRecommendations(request);
}
