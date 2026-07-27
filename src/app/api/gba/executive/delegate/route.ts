import { handleExecutiveDelegate } from "@/lib/gba/executive-api";

export async function POST(request: Request) {
  return handleExecutiveDelegate(request);
}
