import { DiscoveryCoordinator, type DiscoveryResult } from "./DiscoveryCoordinator";
import { DiscoveryJob } from "./DiscoveryJob";
import { DiscoveryRegistry } from "./DiscoveryRegistry";
import type { DiscoveryPlugin } from "./DiscoveryPlugin";
import type { KnowledgeSource } from "./KnowledgeSource";
import { FilesystemDiscoveryPlugin } from "../plugins/filesystem/FilesystemDiscoveryPlugin";
import { JsonDiscoveryPlugin } from "../plugins/json/JsonDiscoveryPlugin";
import { MarkdownDiscoveryPlugin } from "../plugins/markdown/MarkdownDiscoveryPlugin";
import { YamlDiscoveryPlugin } from "../plugins/yaml/YamlDiscoveryPlugin";

export class DiscoveryEngine {
  private readonly registry = new DiscoveryRegistry();
  private readonly coordinator: DiscoveryCoordinator;

  constructor() {
    this.coordinator = new DiscoveryCoordinator(this.registry);
    this.registerPlugin(new MarkdownDiscoveryPlugin());
    this.registerPlugin(new JsonDiscoveryPlugin());
    this.registerPlugin(new YamlDiscoveryPlugin());
    this.registerPlugin(new FilesystemDiscoveryPlugin());
  }

  registerPlugin(plugin: DiscoveryPlugin): void {
    this.registry.register(plugin);
  }

  listPlugins(): DiscoveryPlugin[] {
    return this.registry.list();
  }

  async ingest(source: KnowledgeSource): Promise<DiscoveryResult> {
    const job = new DiscoveryJob({ source });
    return this.coordinator.execute(job);
  }
}
