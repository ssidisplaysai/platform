"use client";

import { useEffect, useRef, useState } from "react";
import { GopInspectorHost } from "@/components/gop/gop-inspector-host";
import type { GlwJobRecord } from "@/lib/glw/jobs";
import type { GenesisExecution } from "@/platform/gop/contracts";
import type { GenesisPersistedEvent } from "@/platform/gop/event-store";
import { mapGlwJobToInspectorJob } from "@/platform/gop/adapters/glw-inspector";

export type GlwJobPanelProps = {
	job: GlwJobRecord | null;
	relatedJobs?: GlwJobRecord[];
	onRetry: (jobId: string) => Promise<GlwJobRecord>;
	onDuplicateRequest?: (job: GlwJobRecord) => void;
};

export function GlwJobPanel({ job, onRetry, onDuplicateRequest }: GlwJobPanelProps) {
	const [events, setEvents] = useState<GenesisPersistedEvent[]>([]);
	const [execution, setExecution] = useState<GenesisExecution | null>(null);
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

	const inspectorJob = job ? mapGlwJobToInspectorJob(job, events) : null;

	return (
		<GopInspectorHost
			job={inspectorJob}
			execution={execution}
			title={job?.title ?? "Selected Job"}
			summary="Live job details, stage tracking, and workflow diagnostics for Genesis operators."
			actions={job ? (
				<>
					{job.status === "FAILED" ? (
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
					{job.status === "FAILED" && onDuplicateRequest ? (
						<button
							type="button"
							onClick={() => onDuplicateRequest(job)}
							className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
						>
							Duplicate Request
						</button>
					) : null}
					{job.status === "COMPLETE" && job.result?.wordpressUrl ? (
						<a
							href={job.result.wordpressUrl}
							target="_blank"
							rel="noreferrer"
							className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
						>
							Open WordPress Draft
						</a>
					) : null}
				</>
			) : null}
		/>
	);
}
