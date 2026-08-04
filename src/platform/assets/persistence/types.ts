import type { AssetPersistedState } from "../contracts";

export type AssetStore = {
  load(): Promise<AssetPersistedState>;
  save(state: AssetPersistedState): Promise<void>;
};
