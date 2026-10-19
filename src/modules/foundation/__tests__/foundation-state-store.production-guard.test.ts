import { FoundationPersistenceError } from "../foundation-persistence";
import {
  getFoundationStateStore,
  resetFoundationStateStoreForTests,
} from "../foundation-state-store";

describe("foundation state store production guard", () => {
  function expectErrorCode(input: () => unknown, code: string) {
    try {
      input();
      throw new Error("EXPECTED_ERROR_NOT_THROWN");
    } catch (error) {
      expect(error).toBeInstanceOf(FoundationPersistenceError);
      expect((error as FoundationPersistenceError).code).toBe(code);
    }
  }

  const originalEnvironment = {
    GENESIS_ENVIRONMENT: process.env.GENESIS_ENVIRONMENT,
    GENESIS_STATE_BACKEND: process.env.GENESIS_STATE_BACKEND,
    NODE_ENV: process.env.NODE_ENV,
  };

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    await resetFoundationStateStoreForTests();
  });

  afterEach(async () => {
    await resetFoundationStateStoreForTests();
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  test("production runtime cannot fall back when backend is missing", () => {
    process.env.GENESIS_ENVIRONMENT = "production";
    delete process.env.GENESIS_STATE_BACKEND;

    expectErrorCode(() => getFoundationStateStore(), "PERSISTENCE_BACKEND_REQUIRED_IN_PRODUCTION");
  });

  test("production runtime cannot use filesystem backend", () => {
    process.env.GENESIS_ENVIRONMENT = "production";
    process.env.GENESIS_STATE_BACKEND = "filesystem";

    expectErrorCode(() => getFoundationStateStore(), "PERSISTENCE_BACKEND_REQUIRED_IN_PRODUCTION");
  });
});
