import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

export class ArtifactStore {
  public constructor(private readonly rootPath: string) {}

  public getRootPath(): string {
    return this.rootPath;
  }

  public getArtifactPath(artifactId: string): string {
    return join(this.rootPath, artifactId);
  }

  public getManifestPath(artifactId: string): string {
    return join(this.getArtifactPath(artifactId), "manifest.json");
  }

  public getMetadataPath(artifactId: string): string {
    return join(this.getArtifactPath(artifactId), "metadata.json");
  }

  public getPayloadPath(artifactId: string): string {
    return join(this.getArtifactPath(artifactId), "payload.json");
  }

  public async ensureRoot(): Promise<void> {
    await mkdir(this.rootPath, { recursive: true });
  }

  public async ensureArtifactDirectory(
    artifactId: string,
  ): Promise<void> {
    await mkdir(this.getArtifactPath(artifactId), {
      recursive: true,
    });
  }

  public async writeJson(
    filePath: string,
    value: unknown,
  ): Promise<void> {
    await writeFile(
      filePath,
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8",
    );
  }

  public async readJson<TValue>(
    filePath: string,
  ): Promise<TValue> {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as TValue;
  }

  public async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  public async listArtifactIds(): Promise<readonly string[]> {
    await this.ensureRoot();

    const entries = await readdir(this.rootPath, {
      withFileTypes: true,
    });

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  }
}
