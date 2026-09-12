"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type CampaignActivationReadiness = {
  knowledgePackReady: boolean;
  approvedReferenceCount: number;
  preparedTargetCount: number;
  grantActive: boolean;
  grantStatus: "NONE" | "ACTIVE" | "EXPIRED" | "CLAIMED" | "CONSUMED" | "INVALIDATED";
  grantExpiresAt: string | null;
  targetFingerprint: string | null;
  certifiedReleaseSha: string | null;
  referenceStateCode: string | null;
  referenceCitySlug: string | null;
  releaseIdentityReady: boolean;
  releaseIdentityReason: string | null;
  releaseCapabilityStatus: "MISSING" | "WRONG_RELEASE" | "OPERATION_NOT_ENABLED" | "READY";
  releaseCapabilityReleaseSha: string | null;
};

export function CampaignActivationAuthorityPanel(props: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  requestRoles: readonly string[];
  readiness: CampaignActivationReadiness;
  globalPromotionAvailable: boolean;
  globalPromotionReason: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"authorize" | "activate" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [authorizationState, setAuthorizationState] = useState<"REQUIRED" | "AUTHORIZING" | "AUTHORIZED" | "FAILED">(
    props.readiness.grantActive ? "AUTHORIZED" : "REQUIRED",
  );
  const referenceApproved = props.readiness.approvedReferenceCount > 0;
  const referenceReady = props.readiness.knowledgePackReady && referenceApproved;
  const missing = [
    !props.readiness.knowledgePackReady ? "Campaign knowledge pack" : null,
    !referenceApproved ? "Approved campaign reference" : null,
    !props.readiness.grantActive ? "Scoped activation authorization" : null,
  ].filter((value): value is string => Boolean(value));

  async function authorize() {
    setBusy("authorize");
    setMessage(null);
    setAuthorizationState("AUTHORIZING");
    try {
      const response = await fetch(`/api/glw/campaigns/${props.campaignId}/activation-authorization`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gcp-roles": props.requestRoles.join(","),
          "x-gcp-organization-id": props.organizationId,
          "x-gcp-site-id": props.siteId,
        },
        body: JSON.stringify({ operation: "AUTHORIZE_ACTIVATION", expiresInMinutes: 15 }),
      });
      const payload = await response.json() as { error?: string; grant?: { status?: string } | null };
      if (!response.ok) throw new Error(payload.error ?? "Activation authorization failed.");
      setAuthorizationState("AUTHORIZED");
      setMessage("Authorization receipt recorded for this campaign. Activation remains a separate action.");
      router.refresh();
    } catch (error) {
      setAuthorizationState("FAILED");
      setMessage(error instanceof Error ? error.message : "Activation authorization failed.");
    } finally {
      setBusy(null);
    }
  }

  async function activate() {
    setBusy("activate");
    setMessage(null);
    try {
      const response = await fetch(`/api/glw/campaigns/${props.campaignId}/activate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gcp-roles": props.requestRoles.join(","),
          "x-gcp-organization-id": props.organizationId,
          "x-gcp-site-id": props.siteId,
        },
        body: JSON.stringify({
          referenceStateCode: props.readiness.referenceStateCode,
          referenceCitySlug: props.readiness.referenceCitySlug,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Campaign activation failed.");
      setMessage("Campaign activated. Dispatch remains a separate action.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign activation failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 border-t border-zinc-800 pt-4">
      <p className="text-xs font-bold uppercase text-zinc-400">Activation authority</p>
      <p className="mt-2 text-xs text-zinc-500">Campaign prepared → Knowledge pack ready → Reference review → Activation authorization → Activate → Dispatch</p>
      {missing.length > 0 ? (
        <div className="mt-3">
          <p className="text-sm font-semibold text-amber-300">Ready except for:</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            {missing.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      ) : <p className="mt-3 text-sm text-emerald-300">Reference and scoped authorization gates are ready.</p>}
      <p className="mt-3 text-sm text-zinc-400">This authorization applies only to this campaign and does not enable publishing or other campaigns.</p>
      <div className="mt-3 border border-zinc-800 p-3" aria-label="Activation authorization status">
        <p className="text-xs font-bold uppercase text-amber-300">Step: Activation Authorization</p>
        <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-zinc-500">Reference</dt><dd className={referenceApproved ? "text-emerald-300" : "text-amber-300"}>{referenceApproved ? "APPROVED" : "REQUIRED"}</dd>
          <dt className="text-zinc-500">Authorization</dt><dd className={authorizationState === "AUTHORIZED" ? "text-emerald-300" : authorizationState === "FAILED" ? "text-red-300" : "text-amber-300"}>{authorizationState === "FAILED" ? "AUTHORIZATION FAILED" : authorizationState}</dd>
          <dt className="text-zinc-500">Release capability</dt><dd className={props.globalPromotionAvailable ? "text-emerald-300" : "text-amber-300"}>{props.globalPromotionAvailable ? "READY" : props.readiness.releaseCapabilityStatus.replaceAll("_", " ")}</dd>
        </dl>
        {authorizationState === "FAILED" && message ? <p className="mt-2 text-sm text-red-300" role="alert">Authorization failed: {message}</p> : null}
        {!props.readiness.releaseIdentityReady ? <p className="mt-2 text-sm text-amber-300">Authorization unavailable: {props.readiness.releaseIdentityReason}</p> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={authorize}
          disabled={!referenceReady || props.readiness.grantActive || !props.readiness.releaseIdentityReady || busy !== null}
          className="border border-amber-600 px-4 py-2 text-sm font-semibold text-amber-200 disabled:border-zinc-700 disabled:text-zinc-600"
        >
          {authorizationState === "AUTHORIZED" ? "Authorized" : authorizationState === "AUTHORIZING" ? "Authorizing..." : authorizationState === "FAILED" ? "Authorization Failed" : "Authorize This Campaign for Activation"}
        </button>
        <button
          type="button"
          onClick={activate}
          disabled={!referenceReady || !props.readiness.grantActive || !props.globalPromotionAvailable || busy !== null}
          className="border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:border-zinc-700 disabled:text-zinc-600"
        >
          {busy === "activate" ? "Activating..." : "Activate Campaign"}
        </button>
      </div>
      {!props.globalPromotionAvailable ? <p className="mt-2 text-xs text-zinc-500">Activation unavailable: {props.globalPromotionReason}</p> : null}
      {message && authorizationState !== "FAILED" ? <p className="mt-3 text-sm text-zinc-300" role="status">{message}</p> : null}
      <details className="mt-4 text-xs text-zinc-500">
        <summary className="cursor-pointer text-zinc-400">Advanced Details</summary>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <dt>Grant status</dt><dd>{props.readiness.grantStatus}</dd>
          <dt>Prepared targets</dt><dd>{props.readiness.preparedTargetCount}</dd>
          <dt>Target fingerprint</dt><dd className="break-all">{props.readiness.targetFingerprint ?? "Unavailable"}</dd>
          <dt>Certified release</dt><dd className="break-all">{props.readiness.certifiedReleaseSha ?? "Not authorized"}</dd>
          <dt>Capability release</dt><dd className="break-all">{props.readiness.releaseCapabilityReleaseSha ?? "Not enabled"}</dd>
          <dt>Expires</dt><dd>{props.readiness.grantExpiresAt ?? "Not authorized"}</dd>
        </dl>
      </details>
    </div>
  );
}
