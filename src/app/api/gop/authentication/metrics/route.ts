import { NextResponse } from "next/server";
import { getGenesisAuthenticationService } from "@/platform/identity/services";

export async function GET(): Promise<NextResponse> {
  const service = getGenesisAuthenticationService();

  return NextResponse.json({
    capability: "identity.authentication",
    metrics: service.getMetrics(),
    providers: service.getProviderHealth(),
  });
}
