export interface EntityDefinition {
  entityType: string;
  businessIdPrefix: string;
  description: string;
  display: {
    label: string;
    pluralLabel: string;
    icon?: string;
    primaryField: string;
    secondaryField?: string;
    defaultSortField?: string;
  };
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    searchable?: boolean;
    sortable?: boolean;
    filterable?: boolean;
    visible?: boolean;
    editable?: boolean;
    unique?: boolean;
    defaultValue?: unknown;
    placeholder?: string;
    validationRule?: string;
  }>;
  relationships: unknown[];
  search: {
    enabled: boolean;
    defaultFields: string[];
    includeRelationships?: boolean;
    includeArchived?: boolean;
  };
  aiEnabled: boolean;
  auditEnabled: boolean;
  archiveEnabled: boolean;
}
