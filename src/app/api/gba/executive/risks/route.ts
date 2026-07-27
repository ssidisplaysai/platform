import { handleExecutiveRisks } from "@/lib/gba/executive-api";

export async function GET(request: Request) {
  return handleExecutiveRisks(request);
}
