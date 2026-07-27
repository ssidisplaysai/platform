import { handleMarketingExecutiveReports } from "@/lib/gba/marketing-api";

export async function GET(request: Request) {
  return handleMarketingExecutiveReports(request);
}
