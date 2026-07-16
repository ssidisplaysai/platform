import { createHash } from "node:crypto";
import type { EnterpriseBlueprintIR } from "./BlueprintIR";
import { stableStringify } from "../core/stableStringify";

export class BlueprintHasher {
  serialize(ir: EnterpriseBlueprintIR): string {
    return stableStringify(ir);
  }

  hash(ir: EnterpriseBlueprintIR): string {
    return createHash("sha256").update(this.serialize(ir)).digest("hex");
  }
}
