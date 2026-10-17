import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateRdsCaCertificate } from "./postgres-ca-preflight.mjs";

test("RDS CA preflight requires a configured path", () => {
  assert.throws(() => validateRdsCaCertificate({}), /GENESIS_RDS_CA_CERT/);
});

test("RDS CA preflight requires a PEM certificate in a readable file", () => {
  const directory = mkdtempSync(join(tmpdir(), "rds-ca-preflight-"));
  const caPath = join(directory, "ca.pem");
  try {
    writeFileSync(caPath, "not a certificate");
    assert.throws(
      () => validateRdsCaCertificate({ GENESIS_RDS_CA_CERT: caPath }),
      /PEM certificate markers/,
    );
    writeFileSync(
      caPath,
      "-----BEGIN CERTIFICATE-----\nY2VydGlmaWNhdGU=\n-----END CERTIFICATE-----\n",
    );
    assert.doesNotThrow(() => validateRdsCaCertificate({ GENESIS_RDS_CA_CERT: caPath }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
