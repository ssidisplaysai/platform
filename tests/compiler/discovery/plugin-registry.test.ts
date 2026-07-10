import assert from "node:assert/strict";
import test from "node:test";
import { DiscoveryEngine } from "../../../src/compiler/discovery/DiscoveryEngine";
import type { DiscoveryPlugin } from "../../../src/compiler/discovery/DiscoveryPlugin";
import type { DiscoveryJob } from "../../../src/compiler/discovery/DiscoveryJob";

class StubMarkdownPlugin implements DiscoveryPlugin {
  readonly name = "StubMarkdownPlugin";
  readonly sourceType = "markdown" as const;

  async discover(_job: DiscoveryJob) {
    return [];
  }
}

test("plugin registry lists default plugins", () => {
  const engine = new DiscoveryEngine();
  const pluginTypes = engine
    .listPlugins()
    .map((plugin) => plugin.sourceType)
    .sort();

  assert.deepEqual(pluginTypes, ["filesystem", "json", "markdown", "yaml"]);
});

test("plugin registry allows overriding source type plugin", () => {
  const engine = new DiscoveryEngine();
  engine.registerPlugin(new StubMarkdownPlugin());

  const markdownPlugin = engine.listPlugins().find((plugin) => plugin.sourceType === "markdown");
  assert.equal(markdownPlugin?.name, "StubMarkdownPlugin");
});
