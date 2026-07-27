import { handleExecutiveOpportunities } from "@/lib/gba/executive-api";

export async function GET(request: Request) {
  return handleExecutiveOpportunities(request);
}
