import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { InventoryPersistenceEnvelope, InventoryPersistenceTenantPartition } from "./types";
import { cloneInventoryPersistenceEnvelope, createDefaultInventoryPersistenceEnvelope, normalizeInventoryPersistenceEnvelope, serializeInventoryPersistenceEnvelope } from "./serialization";

export type InventoryFileStoreOptions = Readonly<{
  rootDir: string;
  runtimeId: string;
}>;

export class InventoryFileStore {
  private readonly rootDir: string;
  private readonly manifestPath: string;
  private readonly tenantDir: string;

  constructor(private readonly options: InventoryFileStoreOptions) {
    this.rootDir = resolve(options.rootDir);
    this.manifestPath = join(this.rootDir, "inventory-manifest.json");
    this.tenantDir = join(this.rootDir, "tenants");
  }

  private tenantFilePath(tenantId: string): string {
    const safeTenant = Buffer.from(tenantId.trim(), "utf8").toString("hex");
    return join(this.tenantDir, `${safeTenant}.json`);
  }

  private async ensureDirectories(): Promise<void> {
    await mkdir(this.tenantDir, { recursive: true });
  }

  private async writeAtomic(filePath: string, content: string): Promise<void> {
    await this.ensureDirectories();
    await mkdir(dirname(filePath), { recursive: true });
    const backupPath = `${filePath}.bak`;
    const tempPath = `${filePath}.${process.pid}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}.tmp`;

    try {
      await rm(backupPath, { force: true });
    } catch {
      /* ignore */
    }

    try {
      await copyFile(filePath, backupPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== "ENOENT") {
        throw error;
      }
    }

    try {
      await writeFile(tempPath, content, "utf8");
      await rename(tempPath, filePath);
      await rm(backupPath, { force: true });
    } catch (error) {
      await rm(tempPath, { force: true });
      try {
        await copyFile(backupPath, filePath);
      } catch {
        /* best effort restore */
      }
      throw error;
    }
  }

  async cleanupStaleArtifacts(): Promise<void> {
    await this.ensureDirectories();
    const entries = await readdir(this.tenantDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || (!entry.name.endsWith(".tmp") && !entry.name.endsWith(".bak"))) {
        continue;
      }
      await rm(join(this.tenantDir, entry.name), { force: true });
    }

    for (const artifact of ["inventory-manifest.json.tmp", "inventory-manifest.json.bak"]) {
      await rm(join(this.rootDir, artifact), { force: true });
    }
  }

  async loadManifest(): Promise<InventoryPersistenceEnvelope> {
    await this.cleanupStaleArtifacts();
    try {
      const content = await readFile(this.manifestPath, "utf8");
      return normalizeInventoryPersistenceEnvelope(JSON.parse(content) as unknown, this.options.runtimeId);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") {
        return createDefaultInventoryPersistenceEnvelope(this.options.runtimeId);
      }
      if (error instanceof SyntaxError) {
        throw new Error("persisted inventory manifest is not valid JSON");
      }
      throw error;
    }
  }

  async saveManifest(envelope: InventoryPersistenceEnvelope): Promise<void> {
    await this.writeAtomic(this.manifestPath, serializeInventoryPersistenceEnvelope(envelope));
  }

  async loadTenantPartition(tenantId: string): Promise<InventoryPersistenceTenantPartition | undefined> {
    try {
      const content = await readFile(this.tenantFilePath(tenantId), "utf8");
      return JSON.parse(content) as InventoryPersistenceTenantPartition;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") {
        return undefined;
      }
      if (error instanceof SyntaxError) {
        throw new Error(`persisted inventory tenant ${tenantId} is not valid JSON`);
      }
      throw error;
    }
  }

  async saveTenantPartition(partition: InventoryPersistenceTenantPartition): Promise<void> {
    await this.writeAtomic(this.tenantFilePath(partition.tenantId), JSON.stringify(partition, null, 2));
  }

  async loadAllPartitions(tenantIds: readonly string[]): Promise<InventoryPersistenceTenantPartition[]> {
    const partitions: InventoryPersistenceTenantPartition[] = [];
    for (const tenantId of tenantIds) {
      const partition = await this.loadTenantPartition(tenantId);
      if (partition) {
        partitions.push(partition);
      }
    }
    return partitions;
  }

  async saveAll(envelope: InventoryPersistenceEnvelope): Promise<void> {
    await this.ensureDirectories();
    for (const partition of envelope.tenants) {
      await this.saveTenantPartition(partition);
    }
    await this.saveManifest(envelope);
  }
}
