const mockCalls: string[] = [];

jest.mock("pdf-parse", () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: async () => {
      mockCalls.push("text");
      return { total: 2, pages: [{ num: 1, text: "Page one" }, { num: 2, text: "Page two" }] };
    },
    getInfo: async () => {
      mockCalls.push("info");
      return { info: { Title: "Owner specification" } };
    },
    destroy: async () => {
      mockCalls.push("destroy");
    },
  })),
}));

import { PdfRawParser } from "../PdfRawParser";

describe("PdfRawParser", () => {
  beforeEach(() => mockCalls.splice(0));

  test("preserves page numbers and extracts metadata sequentially", async () => {
    const result = await new PdfRawParser().parse(Buffer.from("pdf"), "owner.pdf");

    expect(result).toEqual({
      totalPages: 2,
      pages: [{ pageNumber: 1, text: "Page one" }, { pageNumber: 2, text: "Page two" }],
      metadata: { Title: "Owner specification" },
    });
    expect(mockCalls).toEqual(["text", "info", "destroy"]);
  });
});
