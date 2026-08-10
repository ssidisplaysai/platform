import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { cloneManufacturingPersistenceEnvelope, parseManufacturingPersistenceJson, serializeManufacturingPersistenceEnvelope, serializeManufacturingPersistenceManifestFile } from "./serialization";
import { createManufacturingPersistenceSchemaValidator } from "./schema";
import type {
  ManufacturingPersistenceEnvelope,
  ManufacturingPersistenceManifestFile,
  ManufacturingPersistenceTenantPartition,
} from "./types";

export type ManufacturingFileStoreOptions = Readonly<{
  rootDir: string;
}>;

export class ManufacturingFileStore {
  private readonly rootDir: string;
  private readonly manifestPath: string;
  private readonly tenantDir: string;

  constructor(private readonly options: ManufacturingFileStoreOptions) {
    this.rootDir = resolve(options.rootDir);
    this.manifestPath = join(this.rootDir, "manufacturing-manifest.json");
    this.tenantDir = join(this.rootDir, "tenants");
  }

  getRootDir(): string {
    return this.rootDir;
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
    let tempPath = `${filePath}.${process.pid}.${Date.now().toString(36)}.tmp`;

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
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") {
        await rm(tempPath, { force: true });
        await this.ensureDirectories();
        await mkdir(dirname(filePath), { recursive: true });
        tempPath = `${filePath}.${process.pid}.${Date.now().toString(36)}.retry.tmp`;
        await writeFile(tempPath, content, "utf8");
        await rename(tempPath, filePath);
        await rm(backupPath, { force: true });
        return;
      }
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
    for (const fileName of ["manufacturing-manifest.json.bak", "manufacturing-manifest.json.tmp", "manufacturing-manifest.json.retry.tmp"]) {
      await rm(join(this.rootDir, fileName), { force: true });
    }
    const entries = await readdir(this.tenantDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith(".tmp") || entry.name.endsWith(".bak"))) {
        await rm(join(this.tenantDir, entry.name), { force: true });
      }
    }
  }

  async loadManifestFile(): Promise<ManufacturingPersistenceManifestFile | undefined> {
    try {
      const content = await readFile(this.manifestPath, "utf8");
      return parseManufacturingPersistenceJson(content) as ManufacturingPersistenceManifestFile;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") {
        return undefined;
      }
      if (error instanceof SyntaxError) {
        throw new Error("persisted manufacturing manifest is not valid JSON");
      }
      throw error;
    }
  }

  async loadTenantPartition(tenantId: string): Promise<ManufacturingPersistenceTenantPartition | undefined> {
    try {
      const content = await readFile(this.tenantFilePath(tenantId), "utf8");
      return parseManufacturingPersistenceJson(content) as ManufacturingPersistenceTenantPartition;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") {
        return undefined;
      }
      if (error instanceof SyntaxError) {
        throw new Error(`persisted manufacturing tenant ${tenantId} is not valid JSON`);
      }
      throw error;
    }
  }

  async loadAll(): Promise<ManufacturingPersistenceEnvelope | undefined> {
    await this.cleanupStaleArtifacts();
    const manifestFile = await this.loadManifestFile();
    if (!manifestFile) {
      return undefined;
    }
    const validator = createManufacturingPersistenceSchemaValidator();
    validator.validateManifestFileOrThrow(manifestFile);
    const tenants: ManufacturingPersistenceTenantPartition[] = [];
    for (const tenantId of manifestFile.manifest.tenantIds) {
      const partition = await this.loadTenantPartition(tenantId);
      if (!partition) {
        throw new Error(`persisted manufacturing tenant partition is missing: ${tenantId}`);
      }
      validator.validateTenantPartitionOrThrow(partition);
      tenants.push(partition);
    }
    return cloneManufacturingPersistenceEnvelope({
      manifest: manifestFile.manifest,
      runtimeState: manifestFile.runtimeState,
      tenants,
    });
  }

  async saveAll(envelope: ManufacturingPersistenceEnvelope): Promise<void> {
    await this.ensureDirectories();
    const cloned = cloneManufacturingPersistenceEnvelope(envelope);
    for (const partition of cloned.tenants) {
      await this.writeAtomic(this.tenantFilePath(partition.tenantId), JSON.stringify(partition, null, 2));
    }
    await this.writeAtomic(
      this.manifestPath,
      serializeManufacturingPersistenceManifestFile({
        manifest: cloned.manifest,
        runtimeState: cloned.runtimeState,
      }),
    );
  }

  async overwriteWithRawManifest(content: string): Promise<void> {
    await this.writeAtomic(this.manifestPath, content);
  }

  async overwriteWithRawTenant(tenantId: string, content: string): Promise<void> {
    await this.writeAtomic(this.tenantFilePath(tenantId), content);
  }
}
