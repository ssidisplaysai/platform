export interface RuntimeStatus {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly ready: boolean;
  readonly uptimeSeconds: number;
  readonly artifactStorage: "ok" | "error";
  readonly timestamp: string;
}
