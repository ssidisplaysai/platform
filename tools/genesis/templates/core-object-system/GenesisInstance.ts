import type { GenesisObject } from "./GenesisObject";

export interface GenesisInstance<TData = Record<string, unknown>> {
  object: GenesisObject;
  data: TData;
}
