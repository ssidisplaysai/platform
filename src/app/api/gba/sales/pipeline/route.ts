import { handleCreateSalesPipelineRecord, handleSalesPipeline } from "@/lib/gba/sales-api";

export async function GET(request: Request) {
  return handleSalesPipeline(request);
}

export async function POST(request: Request) {
  return handleCreateSalesPipelineRecord(request);
}
