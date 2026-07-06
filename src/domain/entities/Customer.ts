import { BaseEntity } from "./BaseEntity";
import { EntityType } from "../enums/EntityType";

export interface Customer extends BaseEntity {
  entityType: EntityType.Customer;

  primaryContactName?: string;

  primaryContactEmail?: string;

  primaryContactPhone?: string;

  billingAddress?: string;

  shippingAddress?: string;

  industry?: string;

  website?: string;

  notes?: string;
}