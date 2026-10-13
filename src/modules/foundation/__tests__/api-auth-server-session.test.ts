jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { authorizeRequest, forwardOperatorMutationContext, resolveRequestPrincipal, resolveRequestRoles } from "../api-auth";
import { authenticateOperator, createScryptPasswordHash, OPERATOR_CSRF_COOKIE, OPERATOR_CSRF_HEADER, OPERATOR_SESSION_COOKIE } from "../operator-session";

const production = { ...process.env, NODE_ENV: "production", GENESIS_OPERATOR_DIRECTORY_JSON: "[]", GENESIS_TRUSTED_LOCAL_OPERATOR: "false" };
const forged = new NextRequest("https://genesis.example/api/glw/campaigns", { headers: { "x-gcp-roles": "platform_admin", "x-gcp-principal-id": "owner", "x-gcp-session-id": "forged-session", "x-gcp-owner": "true", "x-gcp-email": "owner@example.com" } });

test("production authorization ignores forged role owner email principal and session headers", () => { expect(authorizeRequest(forged, "sites:update", production)).toEqual({ ok: false, status: 401, error: "Unauthorized", roles: [] }); expect(resolveRequestPrincipal(forged, production)).toBeNull(); expect(resolveRequestRoles(forged, production)).toEqual(["viewer"]); });
test("test-only principal adapter cannot activate under production environment", () => { const test = { ...production, NODE_ENV: "test" }; expect(authorizeRequest(forged, "sites:update", test).ok).toBe(true); expect(authorizeRequest(forged, "sites:update", production).ok).toBe(false); });
test("production api-auth consumes the canonical session for reads and CSRF-bound mutations", async () => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = `${process.cwd()}/.gcp-foundation-data-test-api-auth-session`; const password = "correct horse battery staple"; const environment = { ...production, GENESIS_OPERATOR_DIRECTORY_JSON: JSON.stringify([{ principalId: "operator-001", email: "operator@example.com", roles: ["platform_admin"], passwordHash: await createScryptPasswordHash(password, Buffer.alloc(16, 13)) }]) }; const session = await authenticateOperator({ identity: "operator-001", password, environment }); const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`; const read = new NextRequest("https://genesis.example/api/sites", { headers: { cookie } }); expect(authorizeRequest(read, "sites:read", environment)).toMatchObject({ ok: true, roles: ["platform_admin"] }); expect(resolveRequestPrincipal(read, environment)).toEqual({ principalId: "operator-001", sessionId: session.principal.sessionId }); const mutation = new NextRequest("https://genesis.example/api/sites", { method: "POST", headers: { cookie, origin: "https://genesis.example", [OPERATOR_CSRF_HEADER]: session.csrfToken } }); expect(authorizeRequest(mutation, "sites:update", environment)).toMatchObject({ ok: true, roles: ["platform_admin"] }); });
test("trusted local mode supplies platform_admin principal to authorization and scope checks", () => {
	const trustedEnvironment = { ...production, GENESIS_TRUSTED_LOCAL_OPERATOR: "true" };
	const request = new NextRequest("https://genesis.example/api/glw/campaigns?organizationId=led-display-warehouse&siteId=site-led-display-warehouse-production");
	expect(resolveRequestRoles(request, trustedEnvironment)).toEqual(["platform_admin"]);
	expect(resolveRequestPrincipal(request, trustedEnvironment)).toMatchObject({ principalId: "genesis-operator-robert", sessionId: "trusted-local-operator" });
});

test("same-origin internal mutation forwarding preserves session and CSRF authority", async () => {
	const originalRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
	const root = mkdtempSync(join(tmpdir(), "genesis-forwarded-session-"));
	process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
	try {
		const password = "correct horse battery staple";
		const environment = { ...production, GENESIS_OPERATOR_DIRECTORY_JSON: JSON.stringify([{ principalId: "operator-001", email: "operator@example.com", roles: ["platform_admin"], passwordHash: await createScryptPasswordHash(password, Buffer.alloc(16, 19)) }]) };
		const session = await authenticateOperator({ identity: "operator-001", password, environment });
		const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;
		const outer = new NextRequest("https://genesis.example/api/glw/reference-page", { method: "POST", headers: { cookie, origin: "https://genesis.example", [OPERATOR_CSRF_HEADER]: session.csrfToken } });
		const inner = new NextRequest("https://genesis.example/api/glw/page-generation", { method: "POST", headers: forwardOperatorMutationContext(outer) });
		expect(authorizeRequest(inner, "sites:update", environment)).toMatchObject({ ok: true });
		const missingContext = new NextRequest("https://genesis.example/api/glw/page-generation", { method: "POST" });
		expect(authorizeRequest(missingContext, "sites:update", environment)).toMatchObject({ ok: false, status: 401 });
	} finally {
		if (originalRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
		else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalRoot;
		rmSync(root, { recursive: true, force: true });
	}
});