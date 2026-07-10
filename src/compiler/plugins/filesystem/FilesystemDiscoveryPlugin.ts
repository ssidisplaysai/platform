import { readdir, readFile, stat } from "node:fs/promises";
import { extname, resolve, relative } from "node:path";
import type { DiscoveryPlugin } from "../../discovery/DiscoveryPlugin";
import type { DiscoveryJob } from "../../discovery/DiscoveryJob";
import type { RawKnowledgeArtifact } from "../../discovery/KnowledgeArtifact";
import type { KnowledgeSourceType } from "../../discovery/KnowledgeSource";
import { DiscoveryError, isMissingSourceError } from "../../discovery/DiscoveryError";
import { LineageFactory } from "../../provenance/Lineage";

const SUPPORTED_FILE_TYPES: Record<string, Exclude<KnowledgeSourceType, "filesystem">> = {
  ".md": "markdown",
  ".markdown": "markdown",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
};

async function listFiles(root: string): Promise<string[]> {
  const rootStats = await stat(root);
  if (!rootStats.isDirectory()) {
    return [root];
  }

  const discovered: string[] = [];
  const queue: string[] = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    const entries = await readdir(current, { withFileTypes: true });
    const sortedEntries = [...entries].sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of sortedEntries) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile()) {
        discovered.push(fullPath);
      }
    }
  }

  return discovered.sort((a, b) => a.localeCompare(b));
}

export class FilesystemDiscoveryPlugin implements DiscoveryPlugin {
  readonly name = "FilesystemDiscoveryPlugin";
  readonly sourceType = "filesystem" as const;

  async discover(job: DiscoveryJob): Promise<RawKnowledgeArtifact[]> {
    const absoluteRoot = resolve(job.source.origin);
    let filePaths: string[] = [];

    try {
      filePaths = await listFiles(absoluteRoot);
    } catch (error) {
      if (isMissingSourceError(error)) {
        throw new DiscoveryError("MISSING_SOURCE", `Filesystem source not found: ${absoluteRoot}`, error);
      }

      throw error;
    }

    const artifacts: RawKnowledgeArtifact[] = [];

    for (const filePath of filePaths) {
      const extension = extname(filePath).toLowerCase();
      const detectedSourceType = SUPPORTED_FILE_TYPES[extension];

      if (!detectedSourceType) {
        continue;
      }

      const [content, fileStats] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
      const createdAt = fileStats.birthtime.toISOString();
      const modifiedAt = fileStats.mtime.toISOString();
      const relativePath = relative(absoluteRoot, filePath).replace(/\\/g, "/");

      artifacts.push({
        sourceId: `${job.source.id}:${relativePath || "root"}`,
        sourceType: detectedSourceType,
        origin: filePath,
        content,
        metadata: {
          ...(job.source.metadata ?? {}),
          extension,
          plugin: this.name,
          rootedAt: absoluteRoot,
          relativePath,
          discoveredVia: "filesystem",
          size: fileStats.size,
        },
        createdAt,
        modifiedAt,
        discoveredAt: modifiedAt,
        lineage: LineageFactory.create({
          sourceId: job.source.id,
          sourceType: this.sourceType,
          origin: absoluteRoot,
          plugin: this.name,
          parentIds: [job.source.id],
          ingestionPath: relativePath,
        }),
        confidence: 1,
      });
    }

    return artifacts.sort((a, b) => a.origin.localeCompare(b.origin));
  }
}
