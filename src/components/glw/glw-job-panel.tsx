"use client";

import { useEffect, useRef, useState } from "react";
import { GopInspectorHost } from "@/components/gop/gop-inspector-host";
import {
	getGlwQaChecksForDisplay,
	getGlwQaFailureReasonsForDisplay,
	resolveGlwPrimaryOpenLabel,
	resolveGlwPrimaryOpenUrl,
	type GlwJobRecord,
	type GlwQaCheckKey,
	type GlwQaCheckState,
} from "@/lib/glw/jobs";
import type { GlwN8nExecutionDiagnostics } from "@/lib/glw/n8n";
import type { GenesisExecution } from "@/platform/gop/contracts";
import type { GenesisPersistedEvent } from "@/platform/gop/event-store";
import { mapGlwJobToInspectorJob } from "@/platform/gop/adapters/glw-inspector";

export type GlwJobPanelProps = {
	job: GlwJobRecord | null;
	relatedJobs?: GlwJobRecord[];
	onRetry: (jobId: string) => Promise<GlwJobRecord>;
	onDuplicateRequest?: (job: GlwJobRecord) => void;
};

type GlwExecutionDiagnosticsPayload = {
	status?: "available" | "unavailable" | "not_started";
	message?: string;
	reason?: string;
	upstreamStatus?: number;
	upstreamContentType?: string | null;
	upstreamMessage?: string | null;
	openUrl?: string | null;
	execution?: GlwN8nExecutionDiagnostics | null;
};

function formatTimestamp(value: string | null): string {
	if (!value) {
		return "--";
	}

	return new Date(value).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function formatDuration(durationMs: number | null): string {
	if (!durationMs || durationMs < 0) {
		return "--";
	}

	const seconds = Math.floor(durationMs / 1000);
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;

	if (minutes === 0) {
		return `${remainingSeconds}s`;
	}

	return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid grid-cols-[minmax(120px,1fr)_minmax(0,2fr)] gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
			<span className="text-zinc-500">{label}</span>
			<span className="break-words text-zinc-200">{value}</span>
		</div>
	);
}

const qaCheckLabels: Record<GlwQaCheckKey, string> = {
	pageExists: "Page Exists",
	hierarchy: "Hierarchy",
	slug: "Slug",
	title: "Title",
	h1: "H1",
	uniquePrimaryHeading: "Unique Primary Heading",
	duplicateSectionHeadings: "Duplicate Section Headings",
	duplicateSectionContent: "Duplicate Section Content",
	placeholderResourceLinks: "Placeholder Resource Links",
	body: "Body",
	featuredImage: "Featured Image",
	heroImage: "Hero Image",
	seo: "SEO",
	internalLinks: "Internal Links",
	imageAlt: "Image ALT",
	duplicateCheck: "Duplicate Check",
};

function summarizeQaStatus(states: GlwQaCheckState[]): GlwQaCheckState {
	if (states.some((state) => state === "FAIL")) {
		return "FAIL";
	}

	if (states.length > 0 && states.every((state) => state === "PASS")) {
		return "PASS";
	}

	if (states.some((state) => state === "PENDING")) {
		return "PENDING";
	}

	return "UNKNOWN";
}

function qaStatusStyles(status: GlwQaCheckState): string {
	switch (status) {
		case "PASS":
			return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
		case "PENDING":
			return "border-amber-500/30 bg-amber-500/10 text-amber-200";
		case "FAIL":
			return "border-rose-500/30 bg-rose-500/10 text-rose-200";
		default:
			return "border-zinc-700 bg-zinc-800 text-zinc-300";
	}
}

export function GlwJobPanel({ job, onRetry, onDuplicateRequest }: GlwJobPanelProps) {
	const [events, setEvents] = useState<GenesisPersistedEvent[]>([]);
	const [execution, setExecution] = useState<GenesisExecution | null>(null);
	const [n8nDiagnostics, setN8nDiagnostics] = useState<GlwN8nExecutionDiagnostics | null>(null);
	const [n8nStatus, setN8nStatus] = useState<"available" | "unavailable" | "not_started">("not_started");
	const [n8nMessage, setN8nMessage] = useState<string>("Execution has not been accepted by n8n.");
	const [n8nReason, setN8nReason] = useState<string | null>(null);
	const [n8nUpstreamStatus, setN8nUpstreamStatus] = useState<number | null>(null);
	const [n8nUpstreamContentType, setN8nUpstreamContentType] = useState<string | null>(null);
	const [n8nUpstreamMessage, setN8nUpstreamMessage] = useState<string | null>(null);
	const [n8nOpenUrl, setN8nOpenUrl] = useState<string | null>(null);
	const latestSequenceRef = useRef(0);
	const jobId = job?.id ?? null;

	useEffect(() => {
		latestSequenceRef.current = events.length > 0 ? events[events.length - 1].sequence : 0;
	}, [events]);

	useEffect(() => {
		let cancelled = false;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let fallbackPollTimer: ReturnType<typeof setInterval> | null = null;
		let eventSource: EventSource | null = null;

		const mergeEvents = (incoming: GenesisPersistedEvent[]) => {
			setEvents((previous) => {
				const merged = [...previous];
				const known = new Set(previous.map((event) => `${event.eventId}:${event.sequence}`));

				for (const event of incoming) {
					const key = `${event.eventId}:${event.sequence}`;
					if (!known.has(key)) {
						merged.push(event);
						known.add(key);
					}
				}

				return merged.sort((left, right) => left.sequence - right.sequence);
			});
		};

		const loadEvents = async () => {
			if (!jobId) {
				setEvents([]);
				setExecution(null);
				return;
			}

			const response = await fetch(`/api/gop/jobs/${jobId}/events`, {
				cache: "no-store",
				credentials: "include",
			}).catch(() => null);

			if (!response || !response.ok || cancelled) {
				return;
			}

			const payload = await response.json().catch(() => null) as { events?: GenesisPersistedEvent[] } | null;

			if (!cancelled && payload?.events) {
				mergeEvents(payload.events);
			}

			const executionResponse = await fetch(`/api/gop/jobs/${jobId}/execution`, {
				cache: "no-store",
				credentials: "include",
			}).catch(() => null);

			if (!executionResponse || !executionResponse.ok || cancelled) {
				return;
			}

			const executionPayload = await executionResponse.json().catch(() => null) as { execution?: GenesisExecution | null } | null;
			if (!cancelled) {
				setExecution(executionPayload?.execution ?? null);
			}
		};

		const openEventStream = () => {
			if (!jobId || cancelled) {
				return;
			}

			const latestSequence = latestSequenceRef.current;
			eventSource = new EventSource(`/api/gop/jobs/${jobId}/events/stream?afterSequence=${latestSequence}`);

			eventSource.addEventListener("events", (raw) => {
				try {
					const payload = JSON.parse((raw as MessageEvent<string>).data) as { events?: GenesisPersistedEvent[] };
					if (payload.events && payload.events.length > 0) {
						mergeEvents(payload.events);
					}
				} catch {
					// Ignore malformed stream chunks and continue consuming events.
				}
			});

			eventSource.onerror = () => {
				eventSource?.close();
				eventSource = null;
				if (!cancelled) {
					reconnectTimer = setTimeout(() => {
						void loadEvents();
						openEventStream();
					}, 1500);
				}
			};
		};

		void loadEvents().then(() => {
			openEventStream();
		});

		fallbackPollTimer = setInterval(() => {
			void loadEvents();
		}, 10000);

		return () => {
			cancelled = true;
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
			}
			if (fallbackPollTimer) {
				clearInterval(fallbackPollTimer);
			}
			eventSource?.close();
		};
	}, [jobId]);

	useEffect(() => {
		let cancelled = false;
		let interval: ReturnType<typeof setInterval> | null = null;

		const loadDiagnostics = async () => {
			if (!jobId) {
				setN8nDiagnostics(null);
				setN8nStatus("not_started");
				setN8nMessage("Execution has not been accepted by n8n.");
				setN8nReason(null);
				setN8nUpstreamStatus(null);
				setN8nUpstreamContentType(null);
				setN8nUpstreamMessage(null);
				setN8nOpenUrl(null);
				return;
			}

			const response = await fetch(`/api/glw/jobs/${jobId}/execution`, {
				cache: "no-store",
				credentials: "include",
			}).catch(() => null);

			if (!response || cancelled) {
				return;
			}

			const payload = await response.json().catch(() => null) as GlwExecutionDiagnosticsPayload | null;

			if (!response.ok || !payload || cancelled) {
				setN8nDiagnostics(null);
				setN8nStatus("unavailable");
				setN8nMessage("Execution accepted but status unavailable.");
				setN8nReason("Diagnostics endpoint returned an unexpected response.");
				setN8nUpstreamStatus(null);
				setN8nUpstreamContentType(null);
				setN8nUpstreamMessage(null);
				return;
			}

			setN8nDiagnostics(payload.execution ?? null);
			setN8nStatus(payload.status ?? "unavailable");
			setN8nMessage(payload.message ?? "Execution accepted but status unavailable.");
			setN8nReason(payload.reason ?? null);
			setN8nUpstreamStatus(typeof payload.upstreamStatus === "number" ? payload.upstreamStatus : null);
			setN8nUpstreamContentType(payload.upstreamContentType ?? null);
			setN8nUpstreamMessage(payload.upstreamMessage ?? null);
			setN8nOpenUrl(payload.openUrl ?? null);
		};

		void loadDiagnostics();
		interval = setInterval(() => {
			void loadDiagnostics();
		}, 10000);

		return () => {
			cancelled = true;
			if (interval) {
				clearInterval(interval);
			}
		};
	}, [jobId]);

	const inspectorJob = job ? mapGlwJobToInspectorJob(job, events) : null;
	const n8nExecutionLink = n8nDiagnostics?.deepLinkUrl ?? n8nOpenUrl;
	const wordpressUrl = job ? resolveGlwPrimaryOpenUrl(job) ?? "" : "";
	const openPublishingLabel = job ? resolveGlwPrimaryOpenLabel(job) : null;
	const qaChecks = getGlwQaChecksForDisplay(job?.result ?? null);
	const qaFailureReasons = getGlwQaFailureReasonsForDisplay(job?.result ?? null);
	const qaEntries = Object.entries(qaChecks) as Array<[GlwQaCheckKey, GlwQaCheckState]>;
	const qaOverallStatus = summarizeQaStatus(qaEntries.map(([, state]) => state));

	return (
		<section className="space-y-6">
			<GopInspectorHost
				job={inspectorJob}
				execution={execution}
				title={job?.title ?? "Selected Job"}
				summary="Live job details, stage tracking, and workflow diagnostics for Genesis operators."
				actions={job ? (
					<>
						{job.status === "FAILED" || job.status === "FAILED_QA" ? (
							<button
								type="button"
								onClick={() => {
									void onRetry(job.id);
								}}
								className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
							>
								Retry
							</button>
						) : null}
						{(job.status === "FAILED" || job.status === "FAILED_QA") && onDuplicateRequest ? (
							<button
								type="button"
								onClick={() => onDuplicateRequest(job)}
								className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
							>
								Duplicate Request
							</button>
						) : null}
						{n8nExecutionLink ? (
							<a
								href={n8nExecutionLink}
								target="_blank"
								rel="noopener noreferrer"
								className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
							>
								Open n8n Execution
							</a>
						) : null}
						{job.status === "COMPLETE" && openPublishingLabel && wordpressUrl ? (
							<a
								href={wordpressUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
							>
								{openPublishingLabel}
							</a>
						) : null}
					</>
				) : null}
			/>

			{job ? (
				<article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm shadow-zinc-950/20 sm:p-6">
					<p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">n8n Diagnostics</p>
					<h3 className="mt-1 text-lg font-semibold tracking-tight text-white">Execution Observability</h3>
					<p className="mt-2 text-sm text-zinc-400">{n8nMessage}</p>

					{n8nStatus === "available" && n8nDiagnostics ? (
						<div className="mt-4 grid gap-3 sm:grid-cols-2">
							<DetailRow label="Execution ID" value={n8nDiagnostics.executionId} />
							<DetailRow label="Execution State" value={n8nDiagnostics.executionState} />
							<DetailRow label="Current Node" value={n8nDiagnostics.currentNode ?? "--"} />
							<DetailRow label="Last Completed Node" value={n8nDiagnostics.lastCompletedNode ?? "--"} />
							<DetailRow label="Error Node" value={n8nDiagnostics.errorNode ?? "--"} />
							<DetailRow label="Started" value={formatTimestamp(n8nDiagnostics.startedAt)} />
							<DetailRow label="Last Update" value={formatTimestamp(n8nDiagnostics.lastUpdatedAt)} />
							<DetailRow label="Duration" value={formatDuration(n8nDiagnostics.durationMs)} />
							<DetailRow label="HTTP Error Code" value={n8nDiagnostics.errorHttpCode !== null ? String(n8nDiagnostics.errorHttpCode) : "--"} />
							<DetailRow label="Error Description" value={n8nDiagnostics.errorDescription ?? "None"} />
							<DetailRow label="Error" value={n8nDiagnostics.error ?? "None"} />
						</div>
					) : null}

					{n8nStatus === "unavailable" ? (
						<div className="mt-4 rounded-xl border border-amber-700/60 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
							<p>Execution accepted but status unavailable.</p>
							{n8nReason ? <p className="mt-2 text-xs text-amber-200/90">{n8nReason}</p> : null}
							{n8nUpstreamStatus ? <p className="mt-2 text-xs text-amber-200/90">Upstream status: {n8nUpstreamStatus}</p> : null}
							{n8nUpstreamContentType ? <p className="mt-1 text-xs text-amber-200/90">Upstream content type: {n8nUpstreamContentType}</p> : null}
							{n8nUpstreamMessage ? <p className="mt-1 text-xs text-amber-200/90">Upstream message: {n8nUpstreamMessage}</p> : null}
						</div>
					) : null}
				</article>
			) : null}

			{job ? (
				<article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm shadow-zinc-950/20 sm:p-6">
					<p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">QA Status</p>
					<h3 className="mt-1 text-lg font-semibold tracking-tight text-white">Page Production Checks</h3>
					<div className="mt-4 flex items-center gap-3">
						<span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${qaStatusStyles(qaOverallStatus)}`}>
							{qaOverallStatus}
						</span>
						<p className="text-sm text-zinc-400">Deterministic pre-publish gate state.</p>
					</div>
					<details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
						<summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-200">Show QA checks and reasons</summary>
						<div className="grid gap-3 border-t border-zinc-800 px-4 py-4 sm:grid-cols-2">
							{qaEntries.map(([key, state]) => (
								<div key={key} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
									<div className="flex items-center justify-between gap-3">
										<span className="text-zinc-200">{qaCheckLabels[key]}</span>
										<span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${qaStatusStyles(state)}`}>
											{state}
										</span>
									</div>
									{qaFailureReasons[key] ? <p className="mt-2 text-xs text-rose-200">{qaFailureReasons[key]}</p> : null}
								</div>
							))}
						</div>
					</details>
				</article>
			) : null}
		</section>
	);
}
