import { handleExecutiveBriefings } from "@/lib/gba/executive-api";

export async function GET(request: Request) {
  return handleExecutiveBriefings(request);
}
