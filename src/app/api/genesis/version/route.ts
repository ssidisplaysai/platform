import { NextResponse } from "next/server";

import { HealthService } from "../../../../../genesis/runtime/health/health-service";
import { defaultCompilerRegistry } from "../../../../../genesis/runtime/health/compiler-registry";

const healthService = new HealthService(defaultCompilerRegistry);

export async function GET(): Promise<NextResponse> {
  const version = healthService.getVersion();

  return NextResponse.json(version, {
    status: 200,
  });
}
