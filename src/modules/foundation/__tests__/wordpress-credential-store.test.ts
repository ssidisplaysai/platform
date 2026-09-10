import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveStoredWordPressCredential, storeWordPressCredential } from "../wordpress-credential-store";

describe("WordPress credential storage", () => {
  const originalDirectory = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  const originalKey = process.env.GENESIS_CREDENTIAL_MASTER_KEY;
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "genesis-wp-credential-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory;
    process.env.GENESIS_CREDENTIAL_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterEach(() => {
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalDirectory;
    process.env.GENESIS_CREDENTIAL_MASTER_KEY = originalKey;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test("encrypts the application password and returns only a reference", () => {
    const stored = storeWordPressCredential({
      organizationId: "acme",
      siteId: "site-acme-fresh",
      username: "genesis-operator",
      applicationPassword: "abcd efgh ijkl mnop",
    });
    const persisted = fs.readFileSync(path.join(directory, "wordpress-credential-store.json"), "utf8");

    expect(stored).toEqual({ reference: expect.stringMatching(/^credref-wp-/) });
    expect(persisted).not.toContain("genesis-operator");
    expect(persisted).not.toContain("abcdefghijklmnop");
    expect(resolveStoredWordPressCredential(stored.reference)).toEqual({
      username: "genesis-operator",
      applicationPassword: "abcdefghijklmnop",
    });
  });
});