/**
 * Customer Definition Template
 *
 * This is a Phase 5 entity definition template.
 * Generated at 2026-07-06T22:56:44.397Z
 *
 * Entity: Customer
 * Type: entity-definition
 */

import type { EntitySchema } from "@/domain/schema/EntitySchema";

/**
 * Customer Schema
 *
 * Defines the structure, validation, display, and behavior
 * for the Customer business entity.
 */
export const CustomerDefinition: EntitySchema = {
  entityType: "customer",

  businessIdPrefix: "CUSTOMER",

  description: "Customer entity definition (Phase 5 template placeholder)",

  display: {
    label: "Customer",
    pluralLabel: "Customers",
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
