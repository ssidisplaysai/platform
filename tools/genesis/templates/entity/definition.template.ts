/**
 * {{EntityName}} Definition Template
 *
 * This is a Phase 5 entity definition template.
 * Generated at {{GeneratedAt}}
 *
 * Entity: {{EntityName}}
 * Type: entity-definition
 */

import type { EntitySchema } from "@/domain/schema/EntitySchema";

/**
 * {{EntityName}} Schema
 *
 * Defines the structure, validation, display, and behavior
 * for the {{EntityName}} business entity.
 */
export const {{EntityName}}Definition: EntitySchema = {
  entityType: "{{entityNameLower}}",

  businessIdPrefix: "{{EntityNameUpper}}",

  description: "{{EntityName}} entity definition (Phase 5 template placeholder)",

  display: {
    label: "{{EntityName}}",
    pluralLabel: "{{EntityNamePlural}}",
    icon: "cube",
    primaryField: "id",
    secondaryField: "name",
    defaultSortField: "createdAt",
  },

  fields: [
    {
      key: "id",
      label: "ID",
      type: "uuid",
      required: true,
      unique: true,
      searchable: false,
      sortable: false,
      filterable: false,
      visible: true,
    },
    {
      key: "createdAt",
      label: "Created",
      type: "date",
      required: true,
      searchable: false,
      sortable: true,
      filterable: true,
      visible: true,
    },
    {
      key: "updatedAt",
      label: "Updated",
      type: "date",
      required: true,
      searchable: false,
      sortable: true,
      filterable: true,
      visible: true,
    },
  ],

  relationships: [],
  validation: [],
  permissions: ["view", "create", "update", "delete"],
  searchable: true,
  auditable: true,
};
