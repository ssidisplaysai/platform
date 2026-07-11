import type { KnowledgeSourceType } from "../discovery/KnowledgeSource";

export interface Lineage {
  sourceId: string;
  sourceType: KnowledgeSourceType;
  origin: string;
  plugin: string;
  parentIds: string[];
  ingestionPath?: string;
}

export class LineageFactory {
  static create(params: {
    sourceId: string;
    sourceType: KnowledgeSourceType;
    origin: string;
    plugin: string;
    parentIds?: string[];
    ingestionPath?: string;
  }): Lineage {
    return {
      sourceId: params.sourceId,
      sourceType: params.sourceType,
      origin: params.origin,
      plugin: params.plugin,
      parentIds: [...(params.parentIds ?? [])].sort(),
      ingestionPath: params.ingestionPath,
    };
  }
}
