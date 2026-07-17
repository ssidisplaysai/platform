import type { RuntimePolicyEvidenceEntry } from "./types";
import { deepFreeze } from "./types";

export class RuntimePolicyEvidence {
  private sequence = 1;
  private readonly entries: RuntimePolicyEvidenceEntry[] = [];

  append(type: string, details: Readonly<Record<string, unknown>>): RuntimePolicyEvidenceEntry {
    const entry = deepFreeze({
      sequence: this.sequence++,
      type,
      details,
    });
    this.entries.push(entry);
    return entry;
  }

  all(): readonly RuntimePolicyEvidenceEntry[] {
    return Object.freeze([...this.entries]);
  }
}
