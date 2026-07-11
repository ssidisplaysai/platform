import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import type { DiscoveryPlugin } from "../../discovery/DiscoveryPlugin";
import type { DiscoveryJob } from "../../discovery/DiscoveryJob";
import type { RawKnowledgeArtifact } from "../../discovery/KnowledgeArtifact";
import { DiscoveryError, isMissingSourceError } from "../../discovery/DiscoveryError";
import { LineageFactory } from "../../provenance/Lineage";

export class MarkdownDiscoveryPlugin implements DiscoveryPlugin {
  readonly name = "MarkdownDiscoveryPlugin";
  readonly sourceType = "markdown" as const;

  async discover(job: DiscoveryJob): Promise<RawKnowledgeArtifact[]> {
    const extension = extname(job.source.origin).toLowerCase();
    if (extension !== ".md" && extension !== ".markdown") {
      throw new DiscoveryError(
        "UNSUPPORTED_EXTENSION",
        `Markdown plugin cannot ingest extension: ${extension || "<none>"}`,
      );
    }

    let content = "";
    let fileStats: Awaited<ReturnType<typeof stat>>;

    try {
      [content, fileStats] = await Promise.all([
        readFile(job.source.origin, "utf8"),
        stat(job.source.origin),
      ]);
    } catch (error) {
      if (isMissingSourceError(error)) {
        throw new DiscoveryError("MISSING_SOURCE", `Markdown source not found: ${job.source.origin}`, error);
      }

      throw error;
    }

    const createdAt = fileStats.birthtime.toISOString();
    const modifiedAt = fileStats.mtime.toISOString();

    return [
      {
        sourceId: job.source.id,
        sourceType: this.sourceType,
        origin: job.source.origin,
        content,
        metadata: {
          ...(job.source.metadata ?? {}),
          extension,
          size: fileStats.size,
          plugin: this.name,
        },
        createdAt,
        modifiedAt,
        discoveredAt: modifiedAt,
        lineage: LineageFactory.create({
          sourceId: job.source.id,
          sourceType: this.sourceType,
          origin: job.source.origin,
          plugin: this.name,
        }),
        confidence: 1,
      },
    ];
  }
}
