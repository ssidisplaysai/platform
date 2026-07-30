import { NextResponse } from "next/server";
import { getGenesisAuthenticationService } from "@/platform/identity/services";

export async function GET(): Promise<NextResponse> {
  const health = await getGenesisAuthenticationService().healthSnapshot();

  return NextResponse.json({
    capability: "identity.authentication",
    health,
  });
}
