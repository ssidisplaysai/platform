import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "@jest/globals";

import { ArtifactWriter } from "../ArtifactWriter";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("ArtifactWriter", () => {
  it("writes canonical deterministic JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "genesis-artifact-writer-"));
    temporaryDirectories.push(root);

    const writer = new ArtifactWriter(root);

    const first = await writer.writeJson("workbook/inventory.json", {
      zeta: 2,
      alpha: {
        beta: 1,
        alpha: 0,
      },
    });

    const firstContent = await readFile(first.path, "utf8");

    const second = await writer.writeJson("workbook/inventory.json", {
      alpha: {
        alpha: 0,
        beta: 1,
      },
      zeta: 2,
    });

    const secondContent = await readFile(second.path, "utf8");

    expect(firstContent).toBe(secondContent);
    expect(first.sha256).toBe(second.sha256);
    expect(firstContent).toBe(
      '{\n  "alpha": {\n    "alpha": 0,\n    "beta": 1\n  },\n  "zeta": 2\n}\n',
    );
  });
});
