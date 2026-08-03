import { resolve } from "node:path";
import { createFileNotificationPersistence } from "../persistence";
import { createInMemoryProviderRegistry } from "../providers";
import { NotificationEngine } from "./NotificationEngine";

let singleton: NotificationEngine | null = null;

function defaultDataRoot(): string {
  return resolve(process.cwd(), "data");
}

export function getGenesisNotificationEngine(): NotificationEngine {
  if (singleton) {
    return singleton;
  }

  const persistence = createFileNotificationPersistence({
    rootDir: process.env.GENESIS_DATA_ROOT ?? defaultDataRoot(),
  });

  singleton = new NotificationEngine({
    persistence,
    providers: createInMemoryProviderRegistry(),
  });

  return singleton;
}

export async function getGenesisNotificationHealth() {
  const engine = getGenesisNotificationEngine();
  await engine.runRecoveryAudit();
  return engine.healthSnapshot();
}
