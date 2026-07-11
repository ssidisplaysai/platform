import { CustomerDefinition } from "../../domain/definitions/Customer.definition";
import type { EntitySchema } from "../../domain/schema/EntitySchema";
import { MetadataLoader } from "./MetadataLoader";
import { MetadataValidator } from "./MetadataValidator";

export interface RegisteredDefinitionSummary {
  entityType: string;
  label: string;
  fieldCount: number;
}

export interface RuntimeBootResult {
  ready: boolean;
  registeredDefinitions: RegisteredDefinitionSummary[];
  validationErrors: string[];
}

export class MetadataRuntime {
  private registeredDefinitions: EntitySchema[] = [];

  public isReady = false;

  constructor(
    private readonly loader: MetadataLoader = new MetadataLoader(),
    private readonly validator: MetadataValidator = new MetadataValidator(),
  ) {}

  async boot(definitions: readonly EntitySchema[] | undefined | null = [CustomerDefinition]): Promise<RuntimeBootResult> {
    const loadedMetadata = this.loader.load(definitions);
    const validationResults = this.validator.validateAll(loadedMetadata.definitions);

    const validationErrors = validationResults.flatMap((result, index) => {
      const definition = loadedMetadata.definitions[index];
      const entityType = definition?.entityType ?? "unknown";
      return result.errors.map((error) => `${entityType}: ${error.path} - ${error.message}`);
    });

    this.registeredDefinitions = loadedMetadata.definitions.filter((_, index) => validationResults[index]?.valid);
    this.isReady = validationErrors.length === 0;

    return {
      ready: this.isReady,
      registeredDefinitions: this.registeredDefinitions.map((definition) => ({
        entityType: definition.entityType,
        label: definition.display.label,
        fieldCount: definition.fields.length,
      })),
      validationErrors,
    };
  }

  summarizeRegisteredDefinitions(): RegisteredDefinitionSummary[] {
    return this.registeredDefinitions.map((definition) => ({
      entityType: definition.entityType,
      label: definition.display.label,
      fieldCount: definition.fields.length,
    }));
  }
}
