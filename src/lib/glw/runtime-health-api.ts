import { NextResponse } from "next/server";
import { getEnterpriseHealthService } from "@/platform/ehc";
import { getGlwRuntimeVersion } from "./runtime-version";

export async function handleGlwRuntimeHealth(): Promise<NextResponse> {
  const service = await getEnterpriseHealthService();
  const record = await service.retrieveHealth("glw");
  const version = getGlwRuntimeVersion();

  if (!record) {
    return NextResponse.json({
      ...version,
      error: "Health record not found.",
      record: null,
    }, { status: 503 });
  }

  return NextResponse.json({
    ...version,
    record,
  }, { status: 200 });
}

export async function handleGlwRuntimeVersion(): Promise<NextResponse> {
  return NextResponse.json(getGlwRuntimeVersion(), { status: 200 });
}
