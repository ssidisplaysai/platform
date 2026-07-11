import { createHash } from "node:crypto";

export class SourceHash {
  static sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
  }
}
