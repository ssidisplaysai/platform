import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";

describe("WordPress credential resolver sidecar override", () => {
  test("uses an exact transient override when the stored credential is unavailable", () => {
    const reference = "credref-wp-test-sidecar-override";
    const environment = {
      GENESIS_WORDPRESS_CREDENTIAL_OVERRIDE_REFERENCE: reference,
      GENESIS_WORDPRESS_CREDENTIAL_OVERRIDE_USERNAME: "Genesis GLW Publisher",
      GENESIS_WORDPRESS_CREDENTIAL_OVERRIDE_APPLICATION_PASSWORD: "ab cd ef gh",
    } as NodeJS.ProcessEnv;

    expect(
      resolveWordPressCredentialReference(reference, environment),
    ).toEqual({
      username: "Genesis GLW Publisher",
      applicationPassword: "abcdefgh",
    });
  });

  test("does not use an override for a different credential reference", () => {
    const environment = {
      GENESIS_WORDPRESS_CREDENTIAL_OVERRIDE_REFERENCE: "credref-wp-other",
      GENESIS_WORDPRESS_CREDENTIAL_OVERRIDE_USERNAME: "Genesis GLW Publisher",
      GENESIS_WORDPRESS_CREDENTIAL_OVERRIDE_APPLICATION_PASSWORD: "abcdefgh",
    } as NodeJS.ProcessEnv;

    expect(
      resolveWordPressCredentialReference(
        "credref-wp-test-sidecar-override",
        environment,
      ),
    ).toBeNull();
  });
});