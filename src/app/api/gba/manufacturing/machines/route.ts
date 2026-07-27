import { handleManufacturingMachines, handleUpdateManufacturingMachineStatus } from "@/lib/gba/manufacturing-api";

export async function GET(request: Request) {
  return handleManufacturingMachines(request);
}

export async function POST(request: Request) {
  return handleUpdateManufacturingMachineStatus(request);
}
