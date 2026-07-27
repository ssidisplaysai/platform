import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/gmp/knowledge-api", () => ({
  handleGetKnowledgeWorkspace: jest.fn(async () => Response.json({ ok: true })),
  handleCreateKnowledgeRecord: jest.fn(async () => Response.json({ created: true }, { status: 201 })),
  handleListKnowledgeRecords: jest.fn(async () => Response.json({ records: [] })),
}));

import {
  handleCreateKnowledgeRecord,
  handleGetKnowledgeWorkspace,
  handleListKnowledgeRecords,
} from "@/lib/gmp/knowledge-api";
import { GET as getKnowledgeWorkspace } from "@/app/api/gmp/projects/[id]/knowledge/route";
import { GET as getKnowledgeRecords, POST as postKnowledgeRecord } from "@/app/api/gmp/projects/[id]/knowledge/records/route";

describe("gmp knowledge routes", () => {
  it("forwards project id for workspace GET route", async () => {
    const request = new Request("http://localhost/api/gmp/projects/proj-1/knowledge");
    const response = await getKnowledgeWorkspace(request, { params: Promise.resolve({ id: "proj-1" }) });

    expect(response.status).toBe(200);
    expect(handleGetKnowledgeWorkspace).toHaveBeenCalled();
  });

  it("forwards project id for records GET and POST routes", async () => {
    const getRequest = new Request("http://localhost/api/gmp/projects/proj-2/knowledge/records");
    const getResponse = await getKnowledgeRecords(getRequest, { params: Promise.resolve({ id: "proj-2" }) });

    expect(getResponse.status).toBe(200);
    expect(handleListKnowledgeRecords).toHaveBeenCalled();

    const postRequest = new Request("http://localhost/api/gmp/projects/proj-2/knowledge/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    const postResponse = await postKnowledgeRecord(postRequest, { params: Promise.resolve({ id: "proj-2" }) });

    expect(postResponse.status).toBe(201);
    expect(handleCreateKnowledgeRecord).toHaveBeenCalled();
  });
});
