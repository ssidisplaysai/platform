import { BaseEntity } from "../../domain/entities/BaseEntity";

export interface RepositoryQueryOptions<T extends BaseEntity> {
  includeArchived?: boolean;
  companyId?: string;
  status?: T["status"];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface RepositoryResult<T extends BaseEntity> {
  data: T[];
  total: number;
  limit?: number;
  offset?: number;
}

export interface BaseRepository<T extends BaseEntity> {
  findAll(options?: RepositoryQueryOptions<T>): Promise<RepositoryResult<T>>;

  findById(id: string): Promise<T | null>;

  findByBusinessId(businessId: string): Promise<T | null>;

  findByCompanyId(companyId: string): Promise<T[]>;

  create(entity: T): Promise<T>;

  update(id: string, entity: Partial<T>): Promise<T>;

  archive(id: string): Promise<T>;

  restore(id: string): Promise<T>;

  delete(id: string): Promise<void>;
}