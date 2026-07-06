import {
  BaseRepository,
  RepositoryQueryOptions,
  RepositoryResult,
} from "../repositories/BaseRepository";
import { BaseEntity } from "../../domain/entities/BaseEntity";
import { EntityStatus } from "../../domain/enums/EntityStatus";

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ServiceListResult<T> {
  success: boolean;
  data: T[];
  total: number;
  error?: string;
}

export abstract class BaseService<T extends BaseEntity> {
  protected constructor(protected readonly repository: BaseRepository<T>) {}

  async getAll(
    options?: RepositoryQueryOptions<T>,
  ): Promise<ServiceListResult<T>> {
    try {
      const result: RepositoryResult<T> = await this.repository.findAll(options);

      return {
        success: true,
        data: result.data,
        total: result.total,
      };
    } catch (error) {
      return this.handleListError(error);
    }
  }

  async getById(id: string): Promise<ServiceResult<T>> {
    try {
      const entity = await this.repository.findById(id);

      if (!entity) {
        return {
          success: false,
          error: "Entity not found.",
        };
      }

      return {
        success: true,
        data: entity,
      };
    } catch (error) {
      return this.handleSingleError(error);
    }
  }

  async getByBusinessId(businessId: string): Promise<ServiceResult<T>> {
    try {
      const entity = await this.repository.findByBusinessId(businessId);

      if (!entity) {
        return {
          success: false,
          error: "Entity not found.",
        };
      }

      return {
        success: true,
        data: entity,
      };
    } catch (error) {
      return this.handleSingleError(error);
    }
  }

  async getByCompanyId(companyId: string): Promise<ServiceListResult<T>> {
    try {
      const entities = await this.repository.findByCompanyId(companyId);

      return {
        success: true,
        data: entities,
        total: entities.length,
      };
    } catch (error) {
      return this.handleListError(error);
    }
  }

  async create(entity: T): Promise<ServiceResult<T>> {
    try {
      const validationError = this.validate(entity);

      if (validationError) {
        return {
          success: false,
          error: validationError,
        };
      }

      const createdEntity = await this.repository.create(entity);

      return {
        success: true,
        data: createdEntity,
      };
    } catch (error) {
      return this.handleSingleError(error);
    }
  }

  async update(id: string, updates: Partial<T>): Promise<ServiceResult<T>> {
    try {
      const existingEntity = await this.repository.findById(id);

      if (!existingEntity) {
        return {
          success: false,
          error: "Entity not found.",
        };
      }

      const updatedEntity = await this.repository.update(id, {
        ...updates,
        audit: {
          ...existingEntity.audit,
          ...updates.audit,
          updatedAt: new Date(),
          version: existingEntity.audit.version + 1,
        },
      } as Partial<T>);

      return {
        success: true,
        data: updatedEntity,
      };
    } catch (error) {
      return this.handleSingleError(error);
    }
  }

  async changeStatus(
    id: string,
    status: EntityStatus,
  ): Promise<ServiceResult<T>> {
    return this.update(id, { status } as Partial<T>);
  }

  async archive(id: string): Promise<ServiceResult<T>> {
    try {
      const archivedEntity = await this.repository.archive(id);

      return {
        success: true,
        data: archivedEntity,
      };
    } catch (error) {
      return this.handleSingleError(error);
    }
  }

  async restore(id: string): Promise<ServiceResult<T>> {
    try {
      const restoredEntity = await this.repository.restore(id);

      return {
        success: true,
        data: restoredEntity,
      };
    } catch (error) {
      return this.handleSingleError(error);
    }
  }

  protected validate(entity: T): string | null {
    if (!entity.id) return "Entity id is required.";
    if (!entity.businessId) return "Business id is required.";
    if (!entity.entityType) return "Entity type is required.";
    if (!entity.companyId) return "Company id is required.";
    if (!entity.name) return "Entity name is required.";
    if (!entity.status) return "Entity status is required.";
    if (!entity.audit) return "Audit information is required.";

    return null;
  }

  protected handleSingleError(error: unknown): ServiceResult<T> {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown service error.",
    };
  }

  protected handleListError(error: unknown): ServiceListResult<T> {
    return {
      success: false,
      data: [],
      total: 0,
      error: error instanceof Error ? error.message : "Unknown service error.",
    };
  }
}