import { NextResponse } from "next/server";
import { handleGlwRuntimeHealth } from "@/modules/glw/runtime-observability";

export async function GET(): Promise<NextResponse> { return handleGlwRuntimeHealth(); }