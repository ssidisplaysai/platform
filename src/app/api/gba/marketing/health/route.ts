import { handleMarketingHealth } from "@/lib/gba/marketing-api";

export async function GET(request: Request) {
  return handleMarketingHealth(request);
}
