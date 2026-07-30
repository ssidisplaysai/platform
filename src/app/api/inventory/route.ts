import { NextResponse } from "next/server";
import { listInventoryStock } from "@/modules/foundation/inventory-repository";

export async function GET() {
  return NextResponse.json({ inventory: listInventoryStock() });
}
