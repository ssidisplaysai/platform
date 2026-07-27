import { handleMarketingSeo } from "@/lib/gba/marketing-api";

export async function GET(request: Request) {
  return handleMarketingSeo(request);
}
