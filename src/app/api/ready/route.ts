import { NextResponse } from "next/server";
import {
  checkFoundationStateStore,
} from "@/modules/foundation/foundation-state-store";
import { FoundationPersistenceError } from "@/modules/foundation/foundation-persistence";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkFoundationStateStore();
    return NextResponse.json(
      { status: "ready" },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof FoundationPersistenceError
      ? error.code
      : "PERSISTENCE_NOT_READY";
    return NextResponse.json(
      { status: "not_ready", dependency: "state_store", code },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
