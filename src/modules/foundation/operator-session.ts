import "server-only";

import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";
import { deepClone, FoundationPersistenceConflictError, loadPersistedState, savePersistedState } from "./foundation-persistence";
import { resolvePermissions } from "./permissions";
import type { AppRole, PermissionAction } from "./types";

export const OPERATOR_SESSION_COOKIE = "genesis_operator_session";
export const OPERATOR_CSRF_COOKIE = "genesis_operator_csrf";
export const OPERATOR_CSRF_HEADER = "x-genesis-csrf-token";
export const OPERATOR_SESSION_AUTHORITY = "GENESIS_SERVER_SESSION_V1" as const;
export const OPERATOR_SESSION_LIFETIME_SECONDS = 3600;
const TRUSTED_LOCAL_OPERATOR_SESSION_ID = "trusted-local-operator";
const TRUSTED_LOCAL_OPERATOR_PRINCIPAL_ID = "genesis-operator-robert";
const TRUSTED_LOCAL_OPERATOR_EMAIL = "rk@ssidisplays.com";
const TRUSTED_LOCAL_OPERATOR_ROLE: AppRole = "platform_admin";
const NAMESPACE = "genesis-server-verified-operator-session-v1";
const TOKEN_SECRET_NAMESPACE = `${NAMESPACE}-token-secret-v1`;
const scrypt = promisify(scryptCallback);

const ALLOWED_ROLES: readonly AppRole[] = ["platform_admin", "ops_manager", "operations", "company_operator", "analyst", "manufacturing_planner", "manufacturing_engineer", "production_supervisor", "executive", "administrator", "viewer"];
type DirectoryEntry = { principalId: string; email: string; roles: AppRole[]; passwordHash: string; enabled?: boolean };
type SessionRecord = { sessionId: string; principalId: string; principalEmail: string; principalRoles: AppRole[]; tokenHash: string; csrfHash: string; authenticatedAt: string; expiresAt: string; revokedAt: string | null };
type State = { sessions: SessionRecord[] };
type TokenSecretState = { secret: string };
const seed = (): State => ({ sessions: [] });
const normalize = (value: string) => value.trim();
const sessionLifetime = (environment: NodeJS.ProcessEnv = process.env) => { const configured = Number(environment.GENESIS_OPERATOR_SESSION_LIFETIME_SECONDS); return Number.isFinite(configured) ? Math.min(28_800, Math.max(300, Math.floor(configured))) : OPERATOR_SESSION_LIFETIME_SECONDS; };

export type AuthenticatedOperatorPrincipal = { principalId: string; email: string; roles: readonly AppRole[]; capabilities: readonly PermissionAction[]; sessionId: string; authenticatedAt: string; expiresAt: string; authenticationAuthority: typeof OPERATOR_SESSION_AUTHORITY };
export type OperatorSessionResolution = { ok: true; principal: AuthenticatedOperatorPrincipal; csrfToken: string | null } | { ok: false; state: "NOT_AUTHENTICATED" | "SESSION_EXPIRED" | "SESSION_REVOKED" | "SESSION_TAMPERED" | "DIRECTORY_UNAVAILABLE"; principal: null; csrfToken: null };
export type OperatorSessionSecurityPosture = { tokenDigestSecretSource: "ENV" | "PERSISTED_GENERATED"; persistenceRoot: string };

function resolveOperatorSessionPersistenceRoot(environment: NodeJS.ProcessEnv = process.env): string {
  const configuredSessionRoot = environment.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR?.trim();
  if (configuredSessionRoot) return configuredSessionRoot;
  const configuredFoundationRoot = environment.GCP_FOUNDATION_PERSISTENCE_DIR?.trim();
  if (configuredFoundationRoot) return configuredFoundationRoot;
  return join(homedir(), ".genesis-foundation-data");
}

function resolveTokenDigestSecret(environment: NodeJS.ProcessEnv = process.env): { secret: string; source: "ENV" | "PERSISTED_GENERATED" } {
  const fromEnv = environment.GENESIS_OPERATOR_SESSION_TOKEN_SECRET?.trim();
  if (fromEnv) return { secret: fromEnv, source: "ENV" };
  const persistenceRoot = resolveOperatorSessionPersistenceRoot(environment);
  const loaded = loadPersistedState<TokenSecretState>({
    namespace: TOKEN_SECRET_NAMESPACE,
    seedFactory: () => ({ secret: randomBytes(32).toString("base64url") }),
    persistenceRoot,
  });
  const secret = loaded.state.secret?.trim();
  if (!secret) throw new Error("OPERATOR_SESSION_TOKEN_SECRET_UNAVAILABLE");
  if (loaded.seeded) {
    savePersistedState({ namespace: TOKEN_SECRET_NAMESPACE, state: loaded.state, expectedRevision: loaded.revision, persistenceRoot });
  }
  return { secret, source: "PERSISTED_GENERATED" };
}

function digest(value: string, environment: NodeJS.ProcessEnv = process.env): string {
  const { secret } = resolveTokenDigestSecret(environment);
  return createHash("sha256").update(`${secret}:${value}`).digest("hex");
}

export function getOperatorSessionSecurityPosture(environment: NodeJS.ProcessEnv = process.env): OperatorSessionSecurityPosture {
  const persistenceRoot = resolveOperatorSessionPersistenceRoot(environment);
  const { source } = resolveTokenDigestSecret(environment);
  return { tokenDigestSecretSource: source, persistenceRoot };
}

function directory(environment: NodeJS.ProcessEnv = process.env): DirectoryEntry[] {
  const raw = environment.GENESIS_OPERATOR_DIRECTORY_JSON?.trim(); if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown; if (!Array.isArray(parsed)) throw new Error("GENESIS_OPERATOR_DIRECTORY_INVALID");
  return parsed.map((item) => { const value = item as Partial<DirectoryEntry>; const principalId = normalize(value.principalId ?? ""); const email = normalize(value.email ?? "").toLowerCase(); const roles = Array.isArray(value.roles) ? value.roles.filter((role): role is AppRole => ALLOWED_ROLES.includes(role as AppRole)) : []; const passwordHash = normalize(value.passwordHash ?? ""); if (!principalId || !email || !email.includes("@") || !roles.length || !passwordHash.startsWith("scrypt$")) throw new Error("GENESIS_OPERATOR_DIRECTORY_INVALID"); return { principalId, email, roles: [...new Set(roles)], passwordHash, enabled: value.enabled !== false }; });
}

function mutate<T>(change: (state: State) => T, environment: NodeJS.ProcessEnv = process.env): T { const persistenceRoot = resolveOperatorSessionPersistenceRoot(environment); for (let attempt = 0; attempt < 8; attempt += 1) { const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed, persistenceRoot }); const state = deepClone(loaded.state); const result = change(state); try { savePersistedState({ namespace: NAMESPACE, state, expectedRevision: loaded.revision, persistenceRoot }); return result; } catch (error) { if (!(error instanceof FoundationPersistenceConflictError) || attempt === 7) throw error; } } throw new Error("OPERATOR_SESSION_CAS_EXHAUSTED"); }
function readState(environment: NodeJS.ProcessEnv = process.env) { return loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed, persistenceRoot: resolveOperatorSessionPersistenceRoot(environment) }).state; }
function parseCookie(request: NextRequest, name: string) { return request.cookies.get(name)?.value?.trim() || null; }
function secureCookie(request: NextRequest) { return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto")?.toLowerCase() === "https"; }
function cookieOptions(request: NextRequest, httpOnly: boolean) { return { httpOnly, sameSite: "strict" as const, secure: secureCookie(request), path: "/", maxAge: sessionLifetime() }; }

export async function createScryptPasswordHash(password: string, salt = randomBytes(16)): Promise<string> { if (password.length < 12) throw new Error("OPERATOR_PASSWORD_TOO_SHORT"); const derived = await scrypt(password, salt, 64) as Buffer; return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`; }
async function verifyPassword(password: string, encoded: string) { const [scheme, saltValue, hashValue] = encoded.split("$"); if (scheme !== "scrypt" || !saltValue || !hashValue) return false; const expected = Buffer.from(hashValue, "base64url"); const actual = await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length) as Buffer; return actual.length === expected.length && timingSafeEqual(actual, expected); }

export async function authenticateOperator(input: { identity: string; password: string; now?: Date; environment?: NodeJS.ProcessEnv }) { const environment = input.environment ?? process.env; const identity = normalize(input.identity).toLowerCase(); const entries = directory(environment); const entry = entries.find((candidate) => candidate.enabled !== false && (candidate.email === identity || candidate.principalId.toLowerCase() === identity)); const passwordHash = entry?.passwordHash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; const valid = await verifyPassword(input.password, passwordHash).catch(() => false); if (!entry || !valid) throw new Error("OPERATOR_AUTHENTICATION_FAILED"); const now = input.now ?? new Date(); const token = randomBytes(32).toString("base64url"); const csrfToken = randomBytes(32).toString("base64url"); const session: SessionRecord = { sessionId: `genesis-session-${randomUUID()}`, principalId: entry.principalId, principalEmail: entry.email, principalRoles: [...entry.roles], tokenHash: digest(token, environment), csrfHash: digest(csrfToken, environment), authenticatedAt: now.toISOString(), expiresAt: new Date(now.getTime() + sessionLifetime(environment) * 1000).toISOString(), revokedAt: null }; mutate((state) => { state.sessions.push(session); return null; }, environment); return { token, csrfToken, principal: buildPrincipal(session, entry) };
}

function buildPrincipal(session: SessionRecord, entry?: DirectoryEntry): AuthenticatedOperatorPrincipal { const roles = entry?.roles ?? session.principalRoles; const email = entry?.email ?? session.principalEmail; return { principalId: session.principalId, email, roles, capabilities: [...resolvePermissions(roles)], sessionId: session.sessionId, authenticatedAt: session.authenticatedAt, expiresAt: session.expiresAt, authenticationAuthority: OPERATOR_SESSION_AUTHORITY }; }
function testPrincipal(request: NextRequest, environment: NodeJS.ProcessEnv): AuthenticatedOperatorPrincipal | null { if (environment.NODE_ENV !== "test") return null; const roles = (request.headers.get("x-gcp-roles") ?? "").split(",").map((item) => item.trim()).filter((role): role is AppRole => ALLOWED_ROLES.includes(role as AppRole)); if (!roles.length) return null; const principalId = request.headers.get("x-gcp-principal-id")?.trim() || "test-principal"; const sessionId = request.headers.get("x-gcp-session-id")?.trim() || "test-session"; return { principalId, email: "test-principal@invalid.test", roles, capabilities: [...resolvePermissions(roles)], sessionId, authenticatedAt: new Date(0).toISOString(), expiresAt: new Date(8_640_000_000_000_000).toISOString(), authenticationAuthority: OPERATOR_SESSION_AUTHORITY }; }
function trustedLocalOperatorEnabled(environment: NodeJS.ProcessEnv = process.env): boolean { return environment.GENESIS_TRUSTED_LOCAL_OPERATOR === "true"; }
function resolveTrustedLocalOperatorPrincipal(now = new Date(), environment: NodeJS.ProcessEnv = process.env): AuthenticatedOperatorPrincipal {
  try {
    directory(environment);
  } catch {
    // Trusted local mode intentionally does not depend on directory/session persistence for identity resolution.
  }
  const roles: AppRole[] = [TRUSTED_LOCAL_OPERATOR_ROLE];
  return {
    principalId: TRUSTED_LOCAL_OPERATOR_PRINCIPAL_ID,
    email: TRUSTED_LOCAL_OPERATOR_EMAIL,
    roles,
    capabilities: [...resolvePermissions(roles)],
    sessionId: TRUSTED_LOCAL_OPERATOR_SESSION_ID,
    authenticatedAt: now.toISOString(),
    expiresAt: new Date(8_640_000_000_000_000).toISOString(),
    authenticationAuthority: OPERATOR_SESSION_AUTHORITY,
  };
}

export function resolveAuthenticatedOperatorPrincipal(request: NextRequest, now = new Date(), environment: NodeJS.ProcessEnv = process.env): OperatorSessionResolution {
  const injected = testPrincipal(request, environment); if (injected) return { ok: true, principal: injected, csrfToken: null };
  if (trustedLocalOperatorEnabled(environment)) return { ok: true, principal: resolveTrustedLocalOperatorPrincipal(now, environment), csrfToken: null };
  const token = parseCookie(request, OPERATOR_SESSION_COOKIE); if (!token) return { ok: false, state: "NOT_AUTHENTICATED", principal: null, csrfToken: null };
  const state = readState(environment); const session = state.sessions.find((candidate) => candidate.tokenHash === digest(token, environment)); if (!session) return { ok: false, state: "SESSION_TAMPERED", principal: null, csrfToken: null }; if (session.revokedAt) return { ok: false, state: "SESSION_REVOKED", principal: null, csrfToken: null }; if (new Date(session.expiresAt) <= now) return { ok: false, state: "SESSION_EXPIRED", principal: null, csrfToken: null };
  let entries: DirectoryEntry[] | null = null; try { entries = directory(environment); } catch { entries = null; }
  const entry = entries?.find((candidate) => candidate.enabled !== false && candidate.principalId === session.principalId) ?? null;
  const hasSessionPrincipalSnapshot = Boolean(session.principalEmail?.trim() && Array.isArray(session.principalRoles) && session.principalRoles.length > 0);
  if (!entry && entries && entries.length > 0) return { ok: false, state: "DIRECTORY_UNAVAILABLE", principal: null, csrfToken: null };
  if (!entry && !hasSessionPrincipalSnapshot) return { ok: false, state: "DIRECTORY_UNAVAILABLE", principal: null, csrfToken: null };
  const csrfToken = parseCookie(request, OPERATOR_CSRF_COOKIE); return { ok: true, principal: buildPrincipal(session, entry ?? undefined), csrfToken };
}

export function refreshOperatorSessionExpiry(sessionId: string, now = new Date(), environment: NodeJS.ProcessEnv = process.env): string | null {
  return mutate((state) => {
    const session = state.sessions.find((candidate) => candidate.sessionId === sessionId);
    if (!session || session.revokedAt) return null;
    session.expiresAt = new Date(now.getTime() + sessionLifetime(environment) * 1000).toISOString();
    return session.expiresAt;
  }, environment);
}

export function validateOperatorMutationRequest(request: NextRequest, resolution = resolveAuthenticatedOperatorPrincipal(request), environment: NodeJS.ProcessEnv = process.env) { if (!resolution.ok) return false; if (environment.NODE_ENV === "test" && resolution.principal.email === "test-principal@invalid.test") return true; const origin = request.headers.get("origin"); if (!origin || origin !== request.nextUrl.origin) return false; const cookieToken = resolution.csrfToken; const headerToken = request.headers.get(OPERATOR_CSRF_HEADER)?.trim() || null; if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length || !timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) return false; const session = readState(environment).sessions.find((candidate) => candidate.sessionId === resolution.principal.sessionId); return Boolean(session && session.csrfHash === digest(headerToken, environment) && !session.revokedAt);
}

export function revokeOperatorSession(sessionId: string, now = new Date(), environment: NodeJS.ProcessEnv = process.env) { return mutate((state) => { const session = state.sessions.find((candidate) => candidate.sessionId === sessionId); if (!session || session.revokedAt) return false; session.revokedAt = now.toISOString(); return true; }, environment); }
export function setOperatorSessionCookies(response: NextResponse, request: NextRequest, token: string, csrfToken: string) { response.cookies.set(OPERATOR_SESSION_COOKIE, token, cookieOptions(request, true)); response.cookies.set(OPERATOR_CSRF_COOKIE, csrfToken, cookieOptions(request, false)); }
export function clearOperatorSessionCookies(response: NextResponse, request: NextRequest) { response.cookies.set(OPERATOR_SESSION_COOKIE, "", { ...cookieOptions(request, true), maxAge: 0 }); response.cookies.set(OPERATOR_CSRF_COOKIE, "", { ...cookieOptions(request, false), maxAge: 0 }); }
export function getOperatorSessionState(environment: NodeJS.ProcessEnv = process.env) { return deepClone(readState(environment)); }