import { FoundationPersistenceError } from "../foundation/foundation-persistence";
import {
  resolveFoundationPersistenceBackend,
  type FoundationPersistenceBackend,
} from "../foundation/production-persistence-guards";

const SHARE_TO_GROW_SELECTOR = "GENESIS_SHARE_TO_GROW_STATE_BACKEND";

/**
 * Dedicated Share-to-Grow backend selector.
 * Fallback remains the Foundation global selector until runtime wiring is explicitly migrated.
 */
export function resolveShareToGrowPersistenceBackend(
  environment: NodeJS.ProcessEnv = process.env,
): FoundationPersistenceBackend {
  const configured = environment[SHARE_TO_GROW_SELECTOR]?.trim();
  if (!configured) {
    return resolveFoundationPersistenceBackend(environment);
  }
  if (configured !== "filesystem" && configured !== "postgres") {
    throw new FoundationPersistenceError(
      `Unsupported ${SHARE_TO_GROW_SELECTOR} value: ${configured}.`,
      "PERSISTENCE_BACKEND_UNSUPPORTED",
    );
  }
  if ((environment.GENESIS_ENVIRONMENT?.trim() ?? "") === "production" && configured !== "postgres") {
    throw new FoundationPersistenceError(
      `${SHARE_TO_GROW_SELECTOR} must be set to 'postgres' when GENESIS_ENVIRONMENT=production.`,
      "PERSISTENCE_BACKEND_REQUIRED_IN_PRODUCTION",
    );
  }
  return configured;
}
