import { handleMarketingDashboard } from "@/lib/gba/marketing-api";

export async function GET(request: Request) {
  return handleMarketingDashboard(request);
}
