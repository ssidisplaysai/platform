import {
  BaseRepository,
  RepositoryQueryOptions,
  RepositoryResult,
} from "./BaseRepository";
import { BaseEntity } from "../../domain/entities/BaseEntity";
import { EntityStatus } from "../../domain/enums/EntityStatus";

export class InMemoryRepository<T extends BaseEntity>
  implements BaseRepository<T>
{
  protected entities: T[];

  constructor(initialEntities: T[] = []) {
    this.entities = initialEntities;
  }

  async findAll(
    options: RepositoryQueryOptions<T> = {},
  ): Promise<RepositoryResult<T>> {
    let results = [...this.entities];

    if (!options.includeArchived) {
      results = results.filter((entity) => !entity.archived);
    }

    if (options.companyId) {
      results = results.filter((entity) => entity.companyId === options.companyId);
    }

    if (options.status) {
      results = results.filter((entity) => entity.status === options.status);
    }

    if (options.search) {
      const searchTerm = options.search.toLowerCase();

      results = results.filter((entity) => {
        const searchableText = [
          entity.id,
          entity.businessId,
          entity.name,
          entity.description,
          entity.entityType,
          entity.status,
          ...entity.tags.map((tag) => tag.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(searchTerm);
      });
    }

    const total = results.length;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? total;

    results = results.slice(offset, offset + limit);

    return {
      data: results,
      total,
      limit,
      offset,
    };
  }

  async findById(id: string): Promise<T | null> {
    return this.entities.find((entity) => entity.id === id) ?? null;
  }

  async findByBusinessId(businessId: string): Promise<T | null> {
    return (
      this.entities.find((entity) => entity.businessId === businessId) ?? null
    );
  }

  async findByCompanyId(companyId: string): Promise<T[]> {
    return this.entities.filter(
      (entity) => entity.companyId === companyId && !entity.archived,
    );
  }

  async create(entity: T): Promise<T> {
    const existingEntity = await this.findById(entity.id);

    if (existingEntity) {
      throw new Error(`Entity with id "${entity.id}" already exists.`);
    }

    const existingBusinessEntity = await this.findByBusinessId(entity.businessId);

    if (existingBusinessEntity) {
      throw new Error(
        `Entity with business id "${entity.businessId}" already exists.`,
      );
    }

    this.entities.push(entity);

    return entity;
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const index = this.entities.findIndex((entity) => entity.id === id);

    if (index === -1) {
      throw new Error(`Entity with id "${id}" was not found.`);
    }

    const existingEntity = this.entities[index];

    const updatedEntity = {
      ...existingEntity,
      ...updates,
      id: existingEntity.id,
      businessId: existingEntity.businessId,
      entityType: existingEntity.entityType,
    } as T;

    this.entities[index] = updatedEntity;

    return updatedEntity;
  }

  async archive(id: string): Promise<T> {
    return this.update(id, {
      archived: true,
      status: EntityStatus.Archived,
    } as Partial<T>);
  }

  async restore(id: string): Promise<T> {
    return this.update(id, {
      archived: false,
      status: EntityStatus.Active,
    } as Partial<T>);
  }

  async delete(id: string): Promise<void> {
    const index = this.entities.findIndex((entity) => entity.id === id);

    if (index === -1) {
      throw new Error(`Entity with id "${id}" was not found.`);
    }

    this.entities.splice(index, 1);
  }
}