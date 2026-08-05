import type { KnowledgePersistedState } from "../contracts";

export type KnowledgeStore = {
  load(): Promise<KnowledgePersistedState>;
  save(state: KnowledgePersistedState): Promise<void>;
};
