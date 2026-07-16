import { stableStringify } from "../core/stableStringify";
import { SourceHash } from "../provenance/SourceHash";
import type { BusinessGenomeIR } from "./BusinessGenomeIR";

export class BusinessGenomeHasher {
  serialize(ir: BusinessGenomeIR): string {
    return stableStringify(ir);
  }

  hash(ir: BusinessGenomeIR): string {
    return SourceHash.sha256(this.serialize(ir));
  }
}
