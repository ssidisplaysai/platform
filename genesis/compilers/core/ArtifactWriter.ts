import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface WrittenArtifact {
  readonly path: string;
  readonly sha256: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }

  return value;
}

export class ArtifactWriter {
  public constructor(private readonly rootDirectory: string) {}

  public async writeJson(
    relativePath: string,
    data: unknown,
  ): Promise<WrittenArtifact> {
    const fullPath = resolve(this.rootDirectory, relativePath);
    const canonicalData = canonicalize(data);
    const content = `${JSON.stringify(canonicalData, null, 2)}\n`;
    const sha256 = createHash("sha256").update(content).digest("hex");

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf8");

    return {
      path: fullPath,
      sha256,
    };
  }
}
