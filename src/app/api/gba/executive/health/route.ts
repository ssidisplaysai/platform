import { handleExecutiveHealth } from "@/lib/gba/executive-api";

export async function GET(request: Request) {
  return handleExecutiveHealth(request);
}
