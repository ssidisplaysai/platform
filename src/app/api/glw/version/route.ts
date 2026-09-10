import { NextResponse } from "next/server";
import { handleGlwRuntimeVersion } from "@/modules/glw/runtime-observability";

export async function GET(): Promise<NextResponse> { return handleGlwRuntimeVersion(); }