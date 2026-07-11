export type KnowledgeSourceType = "markdown" | "json" | "yaml" | "filesystem";

export interface KnowledgeSource {
  id: string;
  sourceType: KnowledgeSourceType;
  origin: string;
  metadata?: Record<string, unknown>;
}
