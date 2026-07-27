import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/ged/enterprise-domain-api", () => ({
  handleEnterpriseEntities: jest.fn(async () => Response.json({ ok: true })),
  handleEnterpriseEntity: jest.fn(async () => Response.json({ ok: true })),
  handleEnterpriseRelationships: jest.fn(async () => Response.json({ ok: true })),
  handleEnterpriseVersions: jest.fn(async () => Response.json({ ok: true })),
  handleEnterpriseValidation: jest.fn(async () => Response.json({ ok: true })),
  handleEnterpriseHealth: jest.fn(async () => Response.json({ ok: true })),
  handleEnterpriseAudit: jest.fn(async () => Response.json({ ok: true })),
}));

import { GET as getEntitiesRoute } from "@/app/api/ged/entities/route";
import { GET as getEntityRoute } from "@/app/api/ged/entities/[entityKey]/route";
import { GET as getRelationshipsRoute } from "@/app/api/ged/relationships/route";
import { GET as getVersionsRoute } from "@/app/api/ged/versions/route";
import { GET as getValidationRoute } from "@/app/api/ged/validation/route";
import { GET as getHealthRoute } from "@/app/api/ged/health/route";
import { GET as getAuditRoute } from "@/app/api/ged/audit/route";
import { handleEnterpriseAudit, handleEnterpriseEntity, handleEnterpriseEntities, handleEnterpriseHealth, handleEnterpriseRelationships, handleEnterpriseValidation, handleEnterpriseVersions } from "@/lib/ged/enterprise-domain-api";

describe("ged route forwarding", () => {
  it("forwards all GED routes to the API handlers", async () => {
    await getEntitiesRoute(new Request("http://localhost/api/ged/entities"));
    await getEntityRoute(new Request("http://localhost/api/ged/entities/organization"), { params: { entityKey: "organization" } });
    await getRelationshipsRoute(new Request("http://localhost/api/ged/relationships?entityKey=project"));
    await getVersionsRoute(new Request("http://localhost/api/ged/versions?entityKey=project"));
    await getValidationRoute(new Request("http://localhost/api/ged/validation"));
    await getHealthRoute(new Request("http://localhost/api/ged/health"));
    await getAuditRoute(new Request("http://localhost/api/ged/audit?entityKey=project"));

    expect(handleEnterpriseEntities).toHaveBeenCalled();
    expect(handleEnterpriseEntity).toHaveBeenCalled();
    expect(handleEnterpriseRelationships).toHaveBeenCalled();
    expect(handleEnterpriseVersions).toHaveBeenCalled();
    expect(handleEnterpriseValidation).toHaveBeenCalled();
    expect(handleEnterpriseHealth).toHaveBeenCalled();
    expect(handleEnterpriseAudit).toHaveBeenCalled();
  });
});
