import { handleMarketingBrandGovernance } from "@/lib/gba/marketing-api";

export async function GET(request: Request) {
  return handleMarketingBrandGovernance(request);
}
