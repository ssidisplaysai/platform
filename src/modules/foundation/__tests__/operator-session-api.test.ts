jest.mock("server-only", () => ({}));

import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "@/app/api/operator-session/route";
import * as operatorSessionModule from "../operator-session";
import { createScryptPasswordHash, OPERATOR_CSRF_COOKIE, OPERATOR_CSRF_HEADER, OPERATOR_SESSION_COOKIE } from "../operator-session";

const password = "correct horse battery staple";
beforeEach(async () => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = `${process.cwd()}/.gcp-foundation-data-test-session-api-${expect.getState().currentTestName?.replace(/\W+/g, "-")}`; process.env.GENESIS_OPERATOR_DIRECTORY_JSON = JSON.stringify([{ principalId: "operator-001", email: "operator@example.com", roles: ["platform_admin"], passwordHash: await createScryptPasswordHash(password, Buffer.alloc(16, 9)) }]); });
afterEach(() => { delete process.env.GENESIS_OPERATOR_AUTH_DIAGNOSTICS; delete process.env.GENESIS_ENVIRONMENT; });

test("login creates bounded strict cookies and status returns only server principal data", async () => { const login = await POST(new NextRequest("http://localhost:3004/api/operator-session", { method: "POST", headers: { origin: "http://localhost:3004", "content-type": "application/json" }, body: JSON.stringify({ identity: "operator@example.com", password }) })); expect(login.status).toBe(200); const cookies = login.headers.getSetCookie(); const sessionCookie = cookies.find((value) => value.startsWith(`${OPERATOR_SESSION_COOKIE}=`)); const csrfCookie = cookies.find((value) => value.startsWith(`${OPERATOR_CSRF_COOKIE}=`)); expect(sessionCookie).toMatch(/HttpOnly/i); expect(sessionCookie).toMatch(/SameSite=Strict/i); expect(sessionCookie).toMatch(/Max-Age=3600/i); expect(csrfCookie).not.toMatch(/HttpOnly/i); expect(csrfCookie).toMatch(/SameSite=Strict/i); const cookieHeader = cookies.map((value) => value.split(";")[0]).join("; "); const status = await GET(new NextRequest("http://localhost:3004/api/operator-session", { headers: { cookie: cookieHeader } })); expect(await status.json()).toMatchObject({ state: "AUTHENTICATED", authenticated: true, principal: { principalId: "operator-001", email: "operator@example.com", roles: ["platform_admin"], authenticationAuthority: "GENESIS_SERVER_SESSION_V1" } }); });
test("authenticated status check renews bounded cookies and extends session expiry", async () => {
	const login = await POST(new NextRequest("http://localhost:3004/api/operator-session", { method: "POST", headers: { origin: "http://localhost:3004", "content-type": "application/json" }, body: JSON.stringify({ identity: "operator@example.com", password }) }));
	const loginBody = await login.json() as { principal: { expiresAt: string } };
	const cookieHeader = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
	const status = await GET(new NextRequest("http://localhost:3004/api/operator-session", { headers: { cookie: cookieHeader } }));
	const statusBody = await status.json() as { state: string; principal: { expiresAt: string } };
	expect(status.status).toBe(200);
	expect(statusBody.state).toBe("AUTHENTICATED");
	expect(new Date(statusBody.principal.expiresAt).getTime()).toBeGreaterThanOrEqual(new Date(loginBody.principal.expiresAt).getTime());
	const renewedCookies = status.headers.getSetCookie();
	expect(renewedCookies.some((value) => value.startsWith(`${OPERATOR_SESSION_COOKIE}=`) && /Max-Age=3600/i.test(value))).toBe(true);
	expect(renewedCookies.some((value) => value.startsWith(`${OPERATOR_CSRF_COOKIE}=`) && /Max-Age=3600/i.test(value))).toBe(true);
});
test("login denies cross-origin and invalid credentials before creating cookies", async () => { const crossOrigin = await POST(new NextRequest("https://genesis.example/api/operator-session", { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ identity: "operator@example.com", password }) })); expect(crossOrigin.status).toBe(403); expect(crossOrigin.headers.getSetCookie()).toHaveLength(0); const invalid = await POST(new NextRequest("https://genesis.example/api/operator-session", { method: "POST", headers: { origin: "https://genesis.example", "content-type": "application/json" }, body: JSON.stringify({ identity: "operator@example.com", password: "incorrect password" }) })); expect(invalid.status).toBe(401); });
test("HTTPS login marks both session transport cookies Secure", async () => { const login = await POST(new NextRequest("https://genesis.example/api/operator-session", { method: "POST", headers: { origin: "https://genesis.example", "content-type": "application/json" }, body: JSON.stringify({ identity: "operator@example.com", password }) })); expect(login.headers.getSetCookie()).toHaveLength(2); expect(login.headers.getSetCookie().every((cookie) => /Secure/i.test(cookie))).toBe(true); });
test("logout requires same-origin session-bound CSRF and revokes the session", async () => { const login = await POST(new NextRequest("https://genesis.example/api/operator-session", { method: "POST", headers: { origin: "https://genesis.example", "content-type": "application/json" }, body: JSON.stringify({ identity: "operator@example.com", password }) })); const values = Object.fromEntries(login.headers.getSetCookie().map((value) => value.split(";")[0].split("="))); const cookie = `${OPERATOR_SESSION_COOKIE}=${values[OPERATOR_SESSION_COOKIE]}; ${OPERATOR_CSRF_COOKIE}=${values[OPERATOR_CSRF_COOKIE]}`; const logout = await DELETE(new NextRequest("https://genesis.example/api/operator-session", { method: "DELETE", headers: { origin: "https://genesis.example", cookie, [OPERATOR_CSRF_HEADER]: values[OPERATOR_CSRF_COOKIE] } })); expect(logout.status).toBe(200); const status = await GET(new NextRequest("https://genesis.example/api/operator-session", { headers: { cookie } })); expect(status.status).toBe(401); expect(await status.json()).toMatchObject({ state: "SESSION_REVOKED", authenticated: false }); });

test("diagnostics log sanitized origin and body validation failures when explicitly enabled for staging", async () => {
	process.env.GENESIS_OPERATOR_AUTH_DIAGNOSTICS = "true";
	process.env.GENESIS_ENVIRONMENT = "staging";
	const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
	const crossOrigin = await POST(new NextRequest("https://genesis.example/api/operator-session", { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ identity: "operator@example.com", password }) }));
	expect(crossOrigin.status).toBe(403);
	const invalidBody = await POST(new NextRequest("https://genesis.example/api/operator-session", { method: "POST", headers: { origin: "https://genesis.example", "content-type": "application/json" }, body: JSON.stringify({ identity: "operator@example.com", password, injected: true }) }));
	expect(invalidBody.status).toBe(400);
	const entries = warning.mock.calls.map(([line]) => JSON.parse(String(line)));
	expect(entries.map((entry) => entry.category)).toEqual(expect.arrayContaining(["origin_validation_failed", "request_body_invalid"]));
	for (const entry of entries) {
		expect(entry.event).toBe("operator_auth_failure");
		expect(typeof entry.correlationId).toBe("string");
		expect(entry.correlationId.length).toBeGreaterThan(10);
		expect(JSON.stringify(entry)).not.toContain(password);
		expect(JSON.stringify(entry)).not.toContain("operator@example.com");
	}
	warning.mockRestore();
	delete process.env.GENESIS_OPERATOR_AUTH_DIAGNOSTICS;
});

test("diagnostics classify operator lookup and password verification failures while preserving generic response", async () => {
	process.env.GENESIS_OPERATOR_AUTH_DIAGNOSTICS = "true";
	process.env.GENESIS_ENVIRONMENT = "staging";
	const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
	const missingIdentity = await POST(new NextRequest("https://genesis.example/api/operator-session", { method: "POST", headers: { origin: "https://genesis.example", "content-type": "application/json" }, body: JSON.stringify({ identity: "not-found@example.com", password }) }));
	expect(missingIdentity.status).toBe(401);
	expect(await missingIdentity.json()).toEqual({ error: "OPERATOR_AUTHENTICATION_FAILED" });
	const badPassword = await POST(new NextRequest("https://genesis.example/api/operator-session", { method: "POST", headers: { origin: "https://genesis.example", "content-type": "application/json" }, body: JSON.stringify({ identity: "operator@example.com", password: "wrong-password" }) }));
	expect(badPassword.status).toBe(401);
	expect(await badPassword.json()).toEqual({ error: "OPERATOR_AUTHENTICATION_FAILED" });
	const entries = warning.mock.calls.map(([line]) => JSON.parse(String(line)));
	expect(entries.map((entry) => entry.category)).toEqual(expect.arrayContaining(["operator_identity_not_found", "password_verification_failed"]));
	warning.mockRestore();
	delete process.env.GENESIS_OPERATOR_AUTH_DIAGNOSTICS;
});

test("diagnostics classify session and unexpected authentication exceptions without changing browser error shape", async () => {
	process.env.GENESIS_OPERATOR_AUTH_DIAGNOSTICS = "true";
	process.env.GENESIS_ENVIRONMENT = "staging";
	const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
	const spy = jest.spyOn(operatorSessionModule, "authenticateOperator");
	spy.mockRejectedValueOnce(new operatorSessionModule.OperatorAuthenticationError("session_creation_failed", "OPERATOR_AUTHENTICATION_FAILED"));
	const sessionFailure = await POST(new NextRequest("https://genesis.example/api/operator-session", { method: "POST", headers: { origin: "https://genesis.example", "content-type": "application/json" }, body: JSON.stringify({ identity: "operator@example.com", password }) }));
	expect(sessionFailure.status).toBe(401);
	expect(await sessionFailure.json()).toEqual({ error: "OPERATOR_AUTHENTICATION_FAILED" });
	spy.mockRejectedValueOnce(new Error("boom"));
	const unexpected = await POST(new NextRequest("https://genesis.example/api/operator-session", { method: "POST", headers: { origin: "https://genesis.example", "content-type": "application/json" }, body: JSON.stringify({ identity: "operator@example.com", password }) }));
	expect(unexpected.status).toBe(401);
	expect(await unexpected.json()).toEqual({ error: "OPERATOR_AUTHENTICATION_FAILED" });
	const entries = warning.mock.calls.map(([line]) => JSON.parse(String(line)));
	expect(entries.map((entry) => entry.category)).toEqual(expect.arrayContaining(["session_creation_failed", "unexpected_auth_error"]));
	spy.mockRestore();
	warning.mockRestore();
	delete process.env.GENESIS_OPERATOR_AUTH_DIAGNOSTICS;
});