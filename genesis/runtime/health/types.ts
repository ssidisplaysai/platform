export type GenesisRuntimeHealthState = "healthy" | "degraded";

export interface GenesisRuntimeBuildInfo {
  version: string;
  commit: string | null;
  buildDate: string | null;
  environment: string;
}

export interface GenesisRuntimeStorageStatus {
  configured: boolean;
  available: boolean;
}

export interface GenesisRuntimeHealthSnapshot {
  service: "genesis-runtime";
  state: GenesisRuntimeHealthState;
  timestamp: string;
  uptimeSeconds: number;
  build: GenesisRuntimeBuildInfo;
  storage: GenesisRuntimeStorageStatus