import { createHash } from "node:crypto";
import { stableStringify } from "../core/stableStringify";
import type { EnterpriseRuntimeIR } from "./EnterpriseRuntimeIR";

function sanitize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry));
  }

  const obj = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    if (key === "deterministicHash" || key === "deterministicSerialization" || key === "compiledAt") {
      continue;
    }
    next[key] = sanitize(obj[key]);
  }

  return next;
}

export class RuntimeHasher {
  serialize(ir: EnterpriseRuntimeIR): string {
    return stableStringify(sanitize(ir));
  }

  hash(ir: EnterpriseRuntimeIR): string {
    return createHash("sha256").update(this.serialize(ir)).digest("hex");
  }
}
