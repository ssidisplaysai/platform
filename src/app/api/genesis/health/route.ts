import { NextResponse } from "next/server";

import { HealthService } from "../../../../../genesis/runtime/health/health-service";
import { defaultCompilerRegistry } from "../../../../../genesis/runtime/health/compiler-registry";

const healthService = new HealthService(defaultCompilerRegistry);

export async function GET(): Promise<NextResponse> {
  const health = await healthService.getHealth();
  const statusCode =
    health.status === "unhealthy" ? 503 : 200;

  return NextResponse.json(health, {
    status: statusCode,
  });
}
