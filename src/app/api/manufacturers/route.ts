import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { listManufacturers } from "@/modules/foundation/product-repository";

export async function GET() {
  return NextResponse.json({ manufacturers: listManufacturers() });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request, "products:manage_manufacturers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    {
      message: "Manufacturer writes are intentionally deferred in this bounded foundation release.",
    },
    { status: 501 },
  );
}
