import { handleReviewManufacturingRecommendation } from "@/lib/gba/manufacturing-api";

export async function POST(request: Request) {
  return handleReviewManufacturingRecommendation(request);
}
