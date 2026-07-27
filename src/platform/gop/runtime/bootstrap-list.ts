import { buildGlwGenesisModuleManifest } from "../adapters/glw";
import type { GenesisModuleManifest } from "../contracts";

export function getGenesisBootstrapManifests(): GenesisModuleManifest[] {
  return [
    buildGlwGenesisModuleManifest(),
  ];
}
