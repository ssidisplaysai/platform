export interface RuntimeVersion {
  readonly runtime: "Genesis Runtime";
  readonly version: string;
  readonly compilerVersion: string;
  readonly apiVersion: string;
  readonly buildDate: string;
  readonly gitCommit: string;
  readonly environment: string;
}
