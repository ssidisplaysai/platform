import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/modules/foundation/api-auth";
import { runPublicWordPressPreflight } from "@/modules/foundation/wordpress-public-preflight";

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as {
    domain?: unknown;
    apiBaseUrl?: unknown;
    intent?: unknown;
  };

  if (typeof body.domain !== "string" || !body.domain.trim()) {
    return NextResponse.json({ error: "Domain is required." }, { status: 400 });
  }

  try {
    const result = await runPublicWordPressPreflight({
      domain: body.domain,
      apiBaseUrl: typeof body.apiBaseUrl === "string" ? body.apiBaseUrl : null,
      intent: body.intent === "existing" ? "existing" : "fresh",
    });

    return NextResponse.json({ result }, { status: result.ready ? 200 : 422 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Public preflight failed." },
      { status: 400 },
    );
  }
}