import type { ProductPersistedState } from "../contracts";

export type ProductStore = {
  load(): Promise<ProductPersistedState>;
  save(state: ProductPersistedState): Promise<void>;
};
