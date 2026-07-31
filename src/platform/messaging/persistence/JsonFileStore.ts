import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class JsonFileStore<TData> {
  constructor(
    private readonly filePath: string,
    private readonly defaultValue: TData,
  ) {}

  async read(): Promise<TData> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as TData;
    } catch {
      return this.defaultValue;
    }
  }

  async write(data: TData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }
}
