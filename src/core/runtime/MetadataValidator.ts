import type { EntitySchema } from "../../domain/schema/EntitySchema";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

export class MetadataValidator {
  validate(definition: EntitySchema | undefined | null): ValidationResult {
    if (!definition) {
      return {
        valid: false,
        errors: [{ path: "definition", message: "Definition is missing." }],
      };
    }

    const errors: ValidationIssue[] = [];

    if (!definition.entityType) {
      errors.push({ path: "entityType", message: "Entity type is required." });
    }

    if (!definition.display?.label) {
      errors.push({ path: "display.label", message: "Display label is required." });
    }

    if (!definition.display?.primaryField) {
      errors.push({ path: "display.primaryField", message: "Primary display field is required." });
    }

    if (!definition.fields?.length) {
      errors.push({ path: "fields", message: "At least one field is required." });
    } else {
      const fieldNames = new Set<string>();

      for (const field of definition.fields) {
        if (!field?.key) {
          errors.push({ path: "fields.key", message: "Every field requires a key." });
          continue;
        }

        if (fieldNames.has(field.key)) {
          errors.push({ path: `fields.${field.key}`, message: "Field keys must be unique." });
        } else {
          fieldNames.add(field.key);
        }

        if (!field.type) {
          errors.push({ path: `fields.${field.key}.type`, message: "Field type is required." });
        }
      }

      if (!definition.fields.some((field) => field?.key === definition.display.primaryField)) {
        errors.push({
          path: "display.primaryField",
          message: "Primary display field must exist in the entity schema.",
        });
      }
    }

    if (!definition.search?.defaultFields?.length) {
      errors.push({ path: "search.defaultFields", message: "Search default fields are required." });
    }

    if (definition.fields?.some((field) => field?.type === "metadata")) {
      const metadataField = definition.fields.find((field) => field?.type === "metadata");

      if (metadataField && metadataField.key !== "metadata") {
        errors.push({
          path: "fields.metadata",
          message: "The metadata field should use the reserved key metadata.",
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateAll(definitions: readonly (EntitySchema | undefined | null)[] | undefined | null): ValidationResult[] {
    const safeDefinitions = Array.isArray(definitions) ? definitions : [];
    return safeDefinitions.map((definition) => this.validate(definition));
  }
}
