import { handleExecutiveRecommendations } from "@/lib/gba/executive-api";

export async function GET(request: Request) {
  return handleExecutiveRecommendations(request);
}
