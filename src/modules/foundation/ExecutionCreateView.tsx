"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type FormState = {
  organizationId: string;
  customerReference: string;
  ownerReference: string;
  siteReference: string;
  executionNumber: string;
  executionName: string;
  scheduleId: string;
  productionJobId: string;
  operationId: string;
  routingVersionId: string;
  workOrderId: string;
  originSalesOrderId: string;
  originQuoteId: string;
  progress: string;
  actualStart: string;
  actualFinish: string;
  elapsedDurationMinutes: string;
  estimatedDurationMinutes: string;
  notes: string;
  createdBy: string;
};

const INITIAL_STATE: FormState = {
  organizationId: "",
  customerReference: "",
  ownerReference: "",
  siteReference: "",
  executionNumber: "",
  executionName: "",
  scheduleId: "",
  productionJobId: "",
  operationId: "",
  routingVersionId: "",
  workOrderId: "",
  originSalesOrderId: "",
  originQuoteId: "",
  progress: "0",
  actualStart: "",
  actualFinish: "",
  elapsedDurationMinutes: "",
  estimatedDurationMinutes: "",
  notes: "",
  createdBy: "api",
};

export function ExecutionCreateView() {
  const [formState, setFormState] = useState<FormState>(INITIAL_STATE);
  const [message, setMessage] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ field: string; message: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setIssues([]);

    const response = await fetch("/api/executions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: formState.organizationId,
        customerReference: formState.customerReference,
        ownerReference: formState.ownerReference,
        salesRepresentativeReference: null,
        siteReference: formState.siteReference || null,
        executionNumber: formState.executionNumber || null,
        executionName: formState.executionName,
        scheduleId: formState.scheduleId || null,
        productionJobId: formState.productionJobId || null,
        operationId: formState.operationId || null,
        routingVersionId: formState.routingVersionId || null,
        workOrderId: formState.workOrderId || null,
        originSalesOrderId: formState.originSalesOrderId || null,
        originQuoteId: formState.originQuoteId || null,
        progress: Number(formState.progress),
        actualStart: formState.actualStart || null,
        actualFinish: formState.actualFinish || null,
        elapsedDurationMinutes: formState.elapsedDurationMinutes ? Number(formState.elapsedDurationMinutes) : null,
        estimatedDurationMinutes: formState.estimatedDurationMinutes ? Number(formState.estimatedDurationMinutes) : null,
        notes: formState.notes || null,
        attachments: [],
        operatorReferences: [],
        machineReferences: [],
        telemetryReferences: [],
        lineage: {
          scheduleId: formState.scheduleId || null,
          productionJobId: formState.productionJobId || null,
          operationId: formState.operationId || null,
          routingVersionId: formState.routingVersionId || null,
          workOrderId: formState.workOrderId || null,
          originSalesOrderId: formState.originSalesOrderId || null,
          originQuoteId: formState.originQuoteId || null,
          organizationId: formState.organizationId,
          siteReference: formState.siteReference || null,
          correlationId: null,
          causationId: null,
          createdBy: formState.createdBy,
          createdTimestamp: new Date().toISOString(),
        },
        metadata: {},
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { issues?: Array<{ field: string; message: string }>; error?: string };
      setIssues(payload.issues ?? (payload.error ? [{ field: "form", message: payload.error }] : []));
      setMessage("Execution creation failed.");
      setSubmitting(false);
      return;
    }

    const payload = (await response.json()) as { execution?: { documentId: string } };
    setMessage(payload.execution ? `Execution ${payload.execution.documentId} created.` : "Execution created.");
    setFormState(INITIAL_STATE);
    setSubmitting(false);
  }

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Execution Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Create Execution</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Create a tracked execution session from certified planning references.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["organizationId", "Organization Id"],
            ["customerReference", "Customer Reference"],
            ["ownerReference", "Owner Reference"],
            ["siteReference", "Site Reference"],
            ["executionNumber", "Execution Number"],
            ["executionName", "Execution Name"],
            ["scheduleId", "Schedule Id"],
            ["productionJobId", "Production Job Id"],
            ["operationId", "Operation Id"],
            ["routingVersionId", "Routing Version Id"],
            ["workOrderId", "Work Order Id"],
            ["originSalesOrderId", "Origin Sales Order Id"],
            ["originQuoteId", "Origin Quote Id"],
            ["progress", "Progress"],
            ["actualStart", "Actual Start"],
            ["actualFinish", "Actual Finish"],
            ["elapsedDurationMinutes", "Elapsed Duration Minutes"],
            ["estimatedDurationMinutes", "Estimated Duration Minutes"],
            ["createdBy", "Created By"],
          ].map(([field, label]) => (
            <label key={field} className="text-xs uppercase tracking-wide text-zinc-500">
              {label}
              <input
                type="text"
                name={field}
                value={formState[field as keyof FormState]}
                onChange={(event) => setFormState((current) => ({ ...current, [field]: event.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
              />
            </label>
          ))}
        </div>

        <label className="block text-xs uppercase tracking-wide text-zinc-500">
          Notes
          <textarea
            name="notes"
            rows={4}
            value={formState.notes}
            onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-cyan-400 hover:text-white disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Execution"}
        </button>

        {message && <p className="text-sm text-zinc-300">{message}</p>}
        {issues.length > 0 && (
          <ul className="space-y-1 text-sm text-rose-300">
            {issues.map((issue) => (
              <li key={`${issue.field}-${issue.message}`}>{issue.field}: {issue.message}</li>
            ))}
          </ul>
        )}
      </form>
    </section>
  );
}
