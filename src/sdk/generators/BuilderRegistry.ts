import type { EntityBuilder } from "../entities/EntityBuilder";
import type { EntityGenerator } from "./EntityGenerator";

export interface BuilderRegistry {
  registerBuilder(builder: EntityBuilder): void;
  registerGenerator(generator: EntityGenerator): void;
  getBuildersFor(definition: { entityType: string }): EntityBuilder[];
  getGeneratorsFor(definition: { entityType: string }): EntityGenerator[];
}
