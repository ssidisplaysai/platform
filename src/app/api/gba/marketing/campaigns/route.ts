import { handleCreateMarketingCampaignPlan, handleMarketingCampaigns } from "@/lib/gba/marketing-api";

export async function GET(request: Request) {
  return handleMarketingCampaigns(request);
}

export async function POST(request: Request) {
  return handleCreateMarketingCampaignPlan(request);
}
