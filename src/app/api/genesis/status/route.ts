import { NextResponse } from "next/server";

import { HealthService } from "../../../../../genesis/runtime/health/health-service";
import { defaultCompilerRegistry } from "../../../../../genesis/runtime/health/compiler-registry";

const healthService = new HealthService(defaultCompilerRegistry);

export async function GET(): Promise<NextResponse> {
  const status = await healthService.getStatus();
  const statusCode =
    status.status === "unhealthy" ? 503 : 200;

  return NextResponse.json(status, {
    status: statusCode,
  });
}
