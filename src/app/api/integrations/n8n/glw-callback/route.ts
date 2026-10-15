import { NextResponse } from "next/server";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import {
  applyGlwN8nReconnectCallback,
  type GlwReconnectCallbackPayload,
} from "@/modules/glw/n8n-reconnect";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const payload = await request.json().catch(() => null) as GlwReconnectCallbackPayload | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: false, code: "INVALID_JSON" }, { status: 400 });
  }

  const result = await applyGlwN8nReconnectCallback({
    authorizationHeader: request.headers.get("authorization"),
    payload,
    repository: glwPageExecutionRepository,
  });

  return NextResponse.json({
    ok: result.ok,
    code: result.code,
    job: result.job ?? null,
  }, { status: result.status });
}
