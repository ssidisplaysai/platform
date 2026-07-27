import { handleOperationsRecommendations } from "@/lib/gba/operations-api";

export async function GET(request: Request) {
  return handleOperationsRecommendations(request);
}
