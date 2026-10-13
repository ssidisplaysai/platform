import { FoundationPersistenceError } from "../../foundation/foundation-persistence";
import { resolveShareToGrowPersistenceBackend } from "../share-to-grow-persistence-selector";

describe("Share-to-Grow persistence selector", () => {
  function expectErrorCode(input: () => unknown, code: string) {
    try {
      input();
      throw new Error("EXPECTED_ERROR_NOT_THROWN");
    } catch (error) {
      expect(error).toBeInstanceOf(FoundationPersistenceError);
      expect((error as FoundationPersistenceError).code).toBe(code);
    }
  }

  test("uses dedicated selector when configured", () => {
    const backend = resolveShareToGrowPersistenceBackend({
      GENESIS_ENVIRONMENT: "staging",
      GENESIS_STATE_BACKEND: "filesystem",
      GENESIS_SHARE_TO_GROW_STATE_BACKEND: "postgres",
    });
    expect(backend).toBe("postgres");
  });

  test("falls back to global selector when dedicated selector is unset", () => {
    const backend = resolveShareToGrowPersistenceBackend({
      GENESIS_ENVIRONMENT: "staging",
      GENESIS_STATE_BACKEND: "filesystem",
    });
    expect(backend).toBe("filesystem");
  });

  test("rejects unsupported dedicated selector values", () => {
    expectErrorCode(() => resolveShareToGrowPersistenceBackend({
      GENESIS_ENVIRONMENT: "staging",
      GENESIS_SHARE_TO_GROW_STATE_BACKEND: "sqlite",
    }), "PERSISTENCE_BACKEND_UNSUPPORTED");
  });

  test("fails closed in production when dedicated selector is filesystem", () => {
    expectErrorCode(() => resolveShareToGrowPersistenceBackend({
      GENESIS_ENVIRONMENT: "production",
      GENESIS_SHARE_TO_GROW_STATE_BACKEND: "filesystem",
    }), "PERSISTENCE_BACKEND_REQUIRED_IN_PRODUCTION");
  });

  test("permits production postgres on dedicated selector", () => {
    const backend = resolveShareToGrowPersistenceBackend({
      GENESIS_ENVIRONMENT: "production",
      GENESIS_SHARE_TO_GROW_STATE_BACKEND: "postgres",
    });
    expect(backend).toBe("postgres");
  });
});
