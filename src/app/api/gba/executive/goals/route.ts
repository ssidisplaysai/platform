import { handleExecutiveGoals } from "@/lib/gba/executive-api";

export async function GET(request: Request) {
  return handleExecutiveGoals(request);
}
