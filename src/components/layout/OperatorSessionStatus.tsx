"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";

type State = { state: "LOADING" | "AUTHENTICATED" | "SESSION_EXPIRED" | "NOT_AUTHENTICATED" | "SESSION_REVOKED" | "SESSION_TAMPERED" | "DIRECTORY_UNAVAILABLE"; email?: string };
const TRUSTED_LOCAL_OPERATOR_SESSION_ID = "trusted-local-operator";
export function OperatorSessionStatus() {
	const [session, setSession] = useState<State>({ state: "LOADING" });
	const [trustedLocal, setTrustedLocal] = useState(false);

	useEffect(() => {
		let active = true;

		const sync = async () => {
			try {
				const response = await fetch("/api/operator-session", { cache: "no-store" });
				const body = await response.json() as { state?: State["state"]; principal?: { email?: string; sessionId?: string } | null };
				if (!active) return;
				setTrustedLocal(Boolean(response.ok && body.principal?.sessionId === TRUSTED_LOCAL_OPERATOR_SESSION_ID));
				setSession({ state: response.ok ? "AUTHENTICATED" : body.state === "SESSION_EXPIRED" ? "SESSION_EXPIRED" : "NOT_AUTHENTICATED", email: body.principal?.email });
			} catch {
				if (active) {
					setTrustedLocal(false);
					setSession({ state: "NOT_AUTHENTICATED" });
				}
			}
		};

		void sync();
		const intervalId = window.setInterval(() => {
			void sync();
		}, 5 * 60 * 1000);

		return () => {
			active = false;
			window.clearInterval(intervalId);
		};
	}, []);

	async function signOut() {
		const response = await fetch("/api/operator-session", { method: "DELETE", headers: operatorMutationHeaders() });
		if (response.ok) setSession({ state: "NOT_AUTHENTICATED" });
	}

	if (session.state === "LOADING") return <span>Session checking</span>;
	if (session.state === "AUTHENTICATED" && trustedLocal) return <span>Authenticated{session.email ? ` as ${session.email}` : ""}</span>;
	if (session.state === "AUTHENTICATED") return <span className="flex flex-col gap-1">Authenticated{session.email ? ` as ${session.email}` : ""}<button type="button" onClick={() => void signOut()} className="w-fit text-xs text-zinc-400 underline">Sign out</button></span>;
	if (trustedLocal) return null;
	return <Link href="/operator-login">{session.state === "SESSION_EXPIRED" ? "Session expired - sign in" : "Operator sign in required"}</Link>;
}