import { createHash } from "node:crypto";
import { stableStringify } from "../core/stableStringify";
import type { SolutionIR } from "./SolutionIR";

export class SolutionHasher {
  serialize(ir: SolutionIR): string {
    return stableStringify(ir);
  }

  hash(ir: SolutionIR): string {
    return createHash("sha256").update(this.serialize(ir)).digest("hex");
  }
}
