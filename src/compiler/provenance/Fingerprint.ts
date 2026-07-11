import { SourceHash } from "./SourceHash";

export class Fingerprint {
  static fromParts(parts: readonly string[]): string {
    const value = parts.join("|");
    return SourceHash.sha256(value);
  }
}
