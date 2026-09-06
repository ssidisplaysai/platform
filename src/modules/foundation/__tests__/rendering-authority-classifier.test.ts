import { classifyRenderingAuthority, requireOperativeAuthorityMutation } from "../rendering-authority-classifier";

describe("rendering authority classifier", () => {
  test("classifies page 3810 as multi-authority", () => {
    expect(classifyRenderingAuthority({ postContent: "shadow", renderedContent: "<main>Elementor body</main>", publicHtml: "<header>Global</header><main>Elementor body</main><footer>Global</footer>", elementorData: "[{\"id\":\"98e1f56\"}]", elementorEditMode: "builder" })).toBe("MULTI_AUTHORITY");
  });

  test("fails closed when only the post_content shadow changes", () => {
    expect(() => requireOperativeAuthorityMutation({ classification: "MULTI_AUTHORITY", postContentChanged: true, elementorDocumentChanged: false, publicContentChanged: false })).toThrow("post_content shadow");
  });

  test("allows an Elementor authority change to proceed to later gates", () => {
    expect(() => requireOperativeAuthorityMutation({ classification: "MULTI_AUTHORITY", postContentChanged: false, elementorDocumentChanged: true, publicContentChanged: true })).not.toThrow();
  });
});