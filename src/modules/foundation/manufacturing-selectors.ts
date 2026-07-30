import type {
  ManufacturingFoundationRecord,
  ManufacturingListFilters,
  ManufacturingSearchFilters,
  ManufacturingSearchResult,
} from "./manufacturing-types";

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

export function filterManufacturingComponents(
  components: readonly ManufacturingFoundationRecord[],
  filters: ManufacturingListFilters = {},
): readonly ManufacturingFoundationRecord[] {
  return components.filter((component) => {
    if (filters.organizationId && component.organizationId !== filters.organizationId) {
      return false;
    }

    if (filters.siteReference && component.siteReference !== filters.siteReference) {
      return false;
    }

    if (filters.componentType && component.componentType !== filters.componentType) {
      return false;
    }

    if (filters.status && component.status !== filters.status) {
      return false;
    }

    if (filters.query) {
      const q = normalized(filters.query);
      const candidate = `${component.componentNumber} ${component.componentKey} ${component.displayName} ${component.componentType} ${component.status}`.toLowerCase();
      if (!candidate.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

export function searchManufacturingComponents(
  components: readonly ManufacturingFoundationRecord[],
  filters: ManufacturingSearchFilters,
): readonly ManufacturingSearchResult[] {
  const q = normalized(filters.query);

  return components
    .filter((component) => {
      if (filters.organizationId && component.organizationId !== filters.organizationId) {
        return false;
      }
      if (filters.siteReference && component.siteReference !== filters.siteReference) {
        return false;
      }
      return true;
    })
    .map((component) => {
      const matchedFields: string[] = [];

      if (normalized(component.componentNumber).includes(q)) {
        matchedFields.push("componentNumber");
      }
      if (normalized(component.componentKey).includes(q)) {
        matchedFields.push("componentKey");
      }
      if (normalized(component.displayName).includes(q)) {
        matchedFields.push("displayName");
      }
      if (normalized(component.componentType).includes(q)) {
        matchedFields.push("componentType");
      }
      if (normalized(component.status).includes(q)) {
        matchedFields.push("status");
      }

      return {
        componentId: component.componentId,
        componentNumber: component.componentNumber,
        componentKey: component.componentKey,
        componentType: component.componentType,
        status: component.status,
        matchedFields: Array.from(new Set(matchedFields)),
      };
    })
    .filter((result) => result.matchedFields.length > 0);
}
