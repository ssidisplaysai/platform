import { EntityStatus } from "../enums/EntityStatus";
import { EntityType } from "../enums/EntityType";
import { AuditInfo } from "../models/AuditInfo";
import { Metadata } from "../models/Metadata";
import { Tag } from "../models/Tag";

/**
 * Base contract inherited by every business object
 * inside the Genesis platform.
 */

export interface BaseEntity {
  /**
   * Immutable UUID.
   */
  id: string;

  /**
   * Human-readable identifier.
   *
   * Examples:
   * CUS-000152
   * PRJ-000421
   * INV-000083
   */
  businessId: string;

  /**
   * Entity classification.
   */
  entityType: EntityType;

  /**
   * Company ownership.
   */
  companyId: string;

  /**
   * Display name.
   */
  name: string;

  /**
   * Optional long description.
   */
  description?: string;

  /**
   * Current lifecycle status.
   */
  status: EntityStatus;

  /**
   * Soft-delete flag.
   */
  archived: boolean;

  /**
   * Categorization.
   */
  tags: Tag[];

  /**
   * Extensible data storage.
   */
  metadata: Metadata;

  /**
   * Audit information.
   */
  audit: AuditInfo;
}