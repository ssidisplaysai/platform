import { handleManufacturingRecommendations } from "@/lib/gba/manufacturing-api";

export async function GET(request: Request) {
  return handleManufacturingRecommendations(request);
}
