import { NextResponse } from "next/server";
import { handleGlwCapabilityStatus } from "@/modules/glw/runtime-observability";

export async function GET(): Promise<NextResponse> { return handleGlwCapabilityStatus(); }