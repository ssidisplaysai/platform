import type { OrganizationPersistedState } from "../contracts";

export type OrganizationPersistence = {
  load(): Promise<OrganizationPersistedState>;
  save(state: OrganizationPersistedState): Promise<void>;
};
