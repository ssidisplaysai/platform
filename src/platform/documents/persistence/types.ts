import type { DocumentPersistedState } from "../contracts";

export type DocumentStore = {
  load(): Promise<DocumentPersistedState>;
  save(state: DocumentPersistedState): Promise<void>;
};
