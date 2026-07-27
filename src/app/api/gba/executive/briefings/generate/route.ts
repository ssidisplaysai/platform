import { handleGenerateExecutiveBriefing } from "@/lib/gba/executive-api";

export async function POST(request: Request) {
  return handleGenerateExecutiveBriefing(request);
}
