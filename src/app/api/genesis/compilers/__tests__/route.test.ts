import { describe, expect, it } from "@jest/globals";

import { GET } from "../route";

describe("Genesis compiler discovery route", () => {
  it("returns registered compiler metadata from the registry", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.runtime).toBe("Genesis Runtime");
    expect(payload.compilerCount).toBe(1);
    expect(payload.compilers).toHaveLength(1);

    expect(payload.compilers[0]).toEqual(
      expect.objectContaining({
        id: "workbook",
        name: "Workbook Compiler",
        version: "1.0.0",
      }),
    );

    expect(Array.isArray(payload.compilers[0].capabilities)).toBe(true);
  });
});
