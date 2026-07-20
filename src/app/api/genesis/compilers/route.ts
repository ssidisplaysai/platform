import { NextResponse } from "next/server";

import { defaultCompilerRegistry } from "../../../../../genesis/runtime/health/compiler-registry";

export async function GET(): Promise<NextResponse> {
  const compilers = defaultCompilerRegistry.list().map((compiler) => ({
    id: compiler.id,
    name: compiler.name,
    version: compiler.version,
    capabilities: compiler.capabilities,
  }));

  return NextResponse.json(
    {
      runtime: "Genesis Runtime",
      compilerCount: compilers.length,
      compilers,
    },
    { status: 200 },
  );
}
