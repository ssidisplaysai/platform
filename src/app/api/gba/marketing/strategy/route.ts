import { handleMarketingStrategy } from "@/lib/gba/marketing-api";

export async function GET(request: Request) {
  return handleMarketingStrategy(request);
}
