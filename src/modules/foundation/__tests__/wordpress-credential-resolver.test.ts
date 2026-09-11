jest.mock("server-only", () => ({}));

import { createCipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveWordPressCredentialForSite } from "../wordpress-credential-resolver";

describe("scoped WordPress credential resolution", () => {
  const originalDirectory = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  const originalKey = process.env.GENESIS_CREDENTIAL_MASTER_KEY;
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "genesis-wp-read-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory;
    process.env.GENESIS_CREDENTIAL_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterEach(() => {
    if (originalDirectory === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalDirectory;
    if (originalKey === undefined) delete process.env.GENESIS_CREDENTIAL_MASTER_KEY;
    else process.env.GENESIS_CREDENTIAL_MASTER_KEY = originalKey;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function writeCredential() {
    const key = Buffer.alloc(32, 7);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = JSON.stringify({ username: "operator", applicationPassword: "secret-password" });
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    fs.writeFileSync(path.join(directory, "wordpress-credential-store.json"), JSON.stringify({
      schemaVersion: 1,
      revision: 1,
      updatedAt: "2026-09-11T00:00:00.000Z",
      data: {
        credentials: [{
          reference: "credref-wp-test",
          organizationId: "ssi",
          siteId: "site-ssi-projectorenclosure",
          iv: iv.toString("base64"),
          authTag: cipher.getAuthTag().toString("base64"),
          ciphertext: ciphertext.toString("base64"),
        }],
      },
    }));
  }

  test("decrypts only for the exact organization and site", () => {
    writeCredential();
    expect(resolveWordPressCredentialForSite({
      reference: "credref-wp-test",
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
    })).toEqual({ username: "operator", applicationPassword: "secret-password" });
    expect(() => resolveWordPressCredentialForSite({
      reference: "credref-wp-test",
      organizationId: "led-display-warehouse",
      siteId: "site-ssi-projectorenclosure",
    })).toThrow("another organization or site");
    expect(() => resolveWordPressCredentialForSite({
      reference: "credref-wp-test",
      organizationId: "ssi",
      siteId: "site-ssi-screen-solutions-international",
    })).toThrow("another organization or site");
  });

  test("never persists plaintext credential material", () => {
    writeCredential();
    const persisted = fs.readFileSync(path.join(directory, "wordpress-credential-store.json"), "utf8");
    expect(persisted).not.toContain("operator");
    expect(persisted).not.toContain("secret-password");
  });
});