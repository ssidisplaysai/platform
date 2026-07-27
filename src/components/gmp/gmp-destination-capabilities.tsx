import React from "react";

type CapabilityRow = {
  key: string;
  supported: boolean | null;
  requiredByPolicy: boolean;
};

const policyRequired = new Set([
  "createPage",
  "updatePage",
  "setSeoMetadata",
  "setCanonicalUrl",
  "schedulePublication",
  "readBackPublishedContent",
  "verifyPublishedState",
]);

const capabilityLabels: Record<string, string> = {
  createPage: "Create Page",
  updatePage: "Update Page",
  createPost: "Create Post",
  updatePost: "Update Post",
  uploadMedia: "Upload Media",
  setFeaturedMedia: "Set Featured Media",
  setSeoMetadata: "Set SEO Metadata",
  setCanonicalUrl: "Set Canonical URL",
  setOpenGraphMetadata: "Set Open Graph Metadata",
  setStructuredData: "Set Structured Data",
  schedulePublication: "Schedule Publication",
  readBackPublishedContent: "Read Remote State",
  verifyPublishedState: "Verify Published State",
  rollback: "Rollback",
  supportCustomFields: "Custom Fields",
};

function supportText(value: boolean | null): string {
  if (value === true) return "Supported";
  if (value === false) return "Unsupported";
  return "Unknown";
}

export function GmpDestinationCapabilities({ capabilities }: { capabilities: Record<string, boolean> | null | undefined }) {
  const rows: CapabilityRow[] = Object.keys(capabilityLabels).map((key) => ({
    key,
    supported: capabilities && key in capabilities ? Boolean(capabilities[key]) : null,
    requiredByPolicy: policyRequired.has(key),
  }));

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-semibold text-white">Capability Matrix</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase tracking-[0.2em] text-zinc-500">
              <th className="pb-2 pr-3">Capability</th>
              <th className="pb-2 pr-3">Support</th>
              <th className="pb-2 pr-3">Policy</th>
              <th className="pb-2 pr-3">Gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isBlockingGap = row.requiredByPolicy && row.supported === false;
              const isWarningGap = !row.requiredByPolicy && row.supported === false;
              return (
                <tr key={row.key} className="border-b border-zinc-900">
                  <td className="py-2 pr-3 text-zinc-100">{capabilityLabels[row.key]}</td>
                  <td className="py-2 pr-3">{supportText(row.supported)}</td>
                  <td className="py-2 pr-3">{row.requiredByPolicy ? "Required" : "Optional"}</td>
                  <td className="py-2 pr-3">
                    {isBlockingGap ? <span className="text-rose-300">Blocking gap</span> : null}
                    {isWarningGap ? <span className="text-amber-300">Warning gap</span> : null}
                    {!isBlockingGap && !isWarningGap ? <span className="text-zinc-500">None</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
