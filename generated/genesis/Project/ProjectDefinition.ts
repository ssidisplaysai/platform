/**
 * Project Definition Template
 *
 * This is a Phase 5 entity definition template.
 * Generated at 2026-07-06T22:56:09.888Z
 *
 * Entity: Project
 * Type: entity-definition
 */

import type { EntitySchema } from "@/domain/schema/EntitySchema";

/**
 * Project Schema
 *
 * Defines the structure, validation, display, and behavior
 * for the Project business entity.
 */
export const ProjectDefinition: EntitySchema = {
  entityType: "project",

  businessIdPrefix: "PROJECT",

  description: "Project entity definition (Phase 5 template placeholder)",

  display: {
    label: "Project",
    pluralLabel: "Projects",
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
