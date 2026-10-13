import { readFileSync, statSync } from "node:fs";

export function validateRdsCaCertificate(environment = process.env) {
  const certificatePath = environment.GENESIS_RDS_CA_CERT?.trim();
  if (!certificatePath) {
    throw new Error("GENESIS_RDS_CA_CERT must reference the bundled RDS CA certificate file.");
  }

  const fileStats = statSync(certificatePath);
  if (!fileStats.isFile()) {
    throw new Error("GENESIS_RDS_CA_CERT must reference a readable regular file.");
  }

  const certificate = readFileSync(certificatePath, "utf8");
  if (
    !certificate.includes("-----BEGIN CERTIFICATE-----")
    || !certificate.includes("-----END CERTIFICATE-----")
  ) {
    throw new Error("GENESIS_RDS_CA_CERT does not contain PEM certificate markers.");
  }
}
