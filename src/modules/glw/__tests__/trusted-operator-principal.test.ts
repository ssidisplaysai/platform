jest.mock("server-only", () => ({}));

import { NextRequest } from "next/server";
import { authenticateOperator, createScryptPasswordHash, OPERATOR_SESSION_COOKIE } from "@/modules/foundation/operator-session";
import { resolveGlwTrustedOperatorPrincipal } from "../trusted-operator-principal";

const password = "correct horse battery staple";
beforeEach(async () => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = `${process.cwd()}/.gcp-foundation-data-test-trusted-principal-${expect.getState().currentTestName?.replace(/\W+/g, "-")}`; process.env.GENESIS_TRUSTED_LOCAL_OPERATOR = "false"; process.env.GENESIS_OPERATOR_DIRECTORY_JSON = JSON.stringify([{ principalId: "operator-001", email: "operator@example.com", roles: ["platform_admin"], passwordHash: await createScryptPasswordHash(password, Buffer.alloc(16, 11)) }]); });

test("supplies Agent 2's exact principal session and authority contract", async () => { const session = await authenticateOperator({ identity: "operator-001", password }); const resolution = resolveGlwTrustedOperatorPrincipal(new NextRequest("https://genesis.example/api/glw/campaigns/campaign/reference-authority", { headers: { cookie: `${OPERATOR_SESSION_COOKIE}=${session.token}` } })); expect(resolution).toEqual({ ok: true, principal: { principalId: "operator-001", sessionId: session.principal.sessionId, authority: "GENESIS_SERVER_SESSION_V1" } }); });
test("trusted local mode resolves GLW principal without any session cookie", () => {
	const trustedEnvironment = { ...process.env, GENESIS_TRUSTED_LOCAL_OPERATOR: "true" };
	const resolution = resolveGlwTrustedOperatorPrincipal(new NextRequest("https://genesis.example/api/glw/campaigns/campaign/reference-authority"), trustedEnvironment);
	expect(resolution).toEqual({ ok: true, principal: { principalId: "genesis-operator-robert", sessionId: "trusted-local-operator", authority: "GENESIS_SERVER_SESSION_V1" } });
});
test("fails closed with Agent 2's stable unavailable code when no session exists", () => { expect(resolveGlwTrustedOperatorPrincipal(new NextRequest("https://genesis.example/api/glw/campaigns/campaign/reference-authority"))).toEqual({ ok: false, code: "TRUSTED_OPERATOR_SESSION_UNAVAILABLE", message: "A valid server-verified Genesis operator session is required." }); });