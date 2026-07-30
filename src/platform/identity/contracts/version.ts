export const identityContractVersion = "1.0.0" as const;
export const identityContractNamespace = "genesis.identity" as const;
export const identityContractSchemaVersion = "gid-1001.v1" as const;

export type IdentityContractVersion = typeof identityContractVersion;
export type IdentityContractNamespace = typeof identityContractNamespace;
export type IdentityContractSchemaVersion = typeof identityContractSchemaVersion;
