"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";

type State = { state: "LOADING" | "AUTHENTICATED" | "SESSION_EXPIRED" | "NOT_AUTHENTICATED" | "SESSION_REVOKED" | "SESSION_TAMPERED" | "DIRECTORY_UNAVAILABLE"; email?: string };
export function OperatorSessionStatus() {
	const [session, setSession] = useState<State>({ state: "LOADING" });

	useEffect(() => {
		let active = true;

		const sync = async () => {
			try {
				const response = await fetch("/api/operator-session", { cache: "no-store" });
				const body = await response.json() as { state?: State["state"]; principal?: { email?: string } | null };
				if (!active) return;
				setSession({ state: response.ok ? "AUTHENTICATED" : body.state === "SESSION_EXPIRED" ? "SESSION_EXPIRED" : "NOT_AUTHENTICATED", email: body.principal?.email });
			} catch {
				if (active) setSession({ state: "NOT_AUTHENTICATED" });
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
	if (session.state === "AUTHENTICATED") return <span className="flex flex-col gap-1">Authenticated{session.email ? ` as ${session.email}` : ""}<button type="button" onClick={() => void signOut()} className="w-fit text-xs text-zinc-400 underline">Sign out</button></span>;
	return <Link href="/operator-login">{session.state === "SESSION_EXPIRED" ? "Session expired - sign in" : "Operator sign in required"}</Link>;
}