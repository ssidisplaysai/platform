"use client";

import { useMemo, useState } from "react";
import {
  buildOnboardingProfileInput,
  createOnboardingProfileId,
  ONBOARDING_PROFILE_REFERENCE_FIELDS,
  type OnboardingProfileType,
} from "./onboarding-profile-creation";
import type {
  IntegrationProfileConfiguration,
  IntegrationProfileReadinessResult,
  IntegrationProfileReferenceSet,
} from "./types";

type OnboardingProfileCreatorProps = {
  organizationId: string;
  organizationName: string;
  profileType: OnboardingProfileType;
  profileLabel: string;
  existingCount: number;
  onCreated(profile: IntegrationProfileConfiguration): void;
};

export function OnboardingProfileCreator(input: OnboardingProfileCreatorProps) {
  const [open, setOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [description, setDescription] = useState("");
  const [references, setReferences] = useState<Partial<IntegrationProfileReferenceSet>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const fields = ONBOARDING_PROFILE_REFERENCE_FIELDS[input.profileType];
  const profileId = useMemo(
    () => profileName.trim()
      ? createOnboardingProfileId({
          organizationId: input.organizationId,
          profileType: input.profileType,
          profileName,
        })
      : "Generated from organization, type, and display name",
    [input.organizationId, input.profileType, profileName],
  );
  const missingFields = fields
    .filter((field) => !references[field.key]?.trim())
    .map((field) => field.label);

  async function createProfile() {
    setMessage(null);
    setBlockers([]);

    const clientBlockers = [
      ...(!profileName.trim() ? ["Display name is required."] : []),
      ...(!description.trim() ? ["Description / purpose is required."] : []),
      ...missingFields.map((field) => `${field} is required.`),
    ];
    if (clientBlockers.length > 0) {
      setBlockers(clientBlockers);
      return;
    }

    setBusy(true);
    try {
      const profile = buildOnboardingProfileInput({
        organizationId: input.organizationId,
        profileType: input.profileType,
        profileName,
        description,
        references,
      });
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gcp-roles": "ops_manager",
          "x-gcp-organization-id": input.organizationId,
        },
        body: JSON.stringify(profile),
      });
      const payload = (await response.json()) as {
        profile?: IntegrationProfileConfiguration;
        readiness?: IntegrationProfileReadinessResult;
        error?: string;
        issues?: Array<{ message?: string }>;
      };

      if (!response.ok || !payload.profile || !payload.readiness?.ready) {
        setBlockers(
          payload.readiness?.blockers.length
            ? [...payload.readiness.blockers]
            : payload.issues?.map((issue) => issue.message ?? "Invalid profile.")
              ?? [payload.error ?? "Profile creation failed."],
        );
        return;
      }

      input.onCreated(payload.profile);
      setMessage(`${payload.profile.profileName} registered and selected.`);
      setProfileName("");
      setDescription("");
      setReferences({});
      setOpen(false);
    } catch {
      setBlockers(["Genesis could not create the profile."]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setMessage(null);
          setBlockers([]);
        }}
        className="text-xs font-semibold text-red-300 underline decoration-red-900 underline-offset-4 hover:text-red-200"
      >
        {input.existingCount === 0 ? `Create ${input.profileLabel}` : "Create Another"}
      </button>

      {open ? (
        <section className="mt-3 border border-zinc-700 bg-zinc-900/70 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">
              Profile Type
              <input value={input.profileType} disabled className="mt-1 h-10 w-full border border-zinc-800 bg-zinc-950 px-3 text-zinc-400" />
            </label>
            <label className="text-xs text-zinc-400">
              Organization
              <input value={`${input.organizationName} (${input.organizationId})`} disabled className="mt-1 h-10 w-full border border-zinc-800 bg-zinc-950 px-3 text-zinc-400" />
            </label>
            <label className="text-xs text-zinc-300 sm:col-span-2">
              Display Name
              <input value={profileName} onChange={(event) => setProfileName(event.target.value)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white" />
            </label>
            <label className="text-xs text-zinc-300 sm:col-span-2">
              Description / Purpose
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
            </label>
            {fields.map((field) => (
              <label key={field.key} className="text-xs text-zinc-300">
                {field.label}
                <input
                  value={references[field.key] ?? ""}
                  onChange={(event) => setReferences((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))}
                  placeholder={field.placeholder}
                  className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white"
                />
              </label>
            ))}
          </div>
          <dl className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
            <div><dt>Profile ID</dt><dd className="break-all text-zinc-200">{profileId}</dd></div>
            <div><dt>Version</dt><dd className="text-zinc-200">1.0.0</dd></div>
          </dl>
          {blockers.length > 0 ? (
            <ul className="mt-3 space-y-1 border-l-2 border-amber-500 pl-3 text-xs text-amber-200">
              {blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          ) : null}
          <div className="mt-4 flex justify-end">
            <button type="button" disabled={busy} onClick={createProfile} className="bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
              {busy ? "Creating..." : "Register Profile"}
            </button>
          </div>
        </section>
      ) : null}

      {message ? <p className="mt-2 text-xs text-emerald-300">{message}</p> : null}
    </div>
  );
}