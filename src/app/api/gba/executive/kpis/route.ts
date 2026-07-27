import { handleExecutiveKpis } from "@/lib/gba/executive-api";

export async function GET(request: Request) {
  return handleExecutiveKpis(request);
}
